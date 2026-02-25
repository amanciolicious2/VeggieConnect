const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Try to use environment variables first (for Vercel)
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // Fallback to application default (for local development)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    // Try application default as last resort
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

// Convert PayMongo payment method to display name
function getPaymentMethodDisplayName(paymentMethod) {
  switch (paymentMethod.toLowerCase()) {
    case 'gcash':
      return 'GCash';
    case 'grab_pay':
      return 'GrabPay';
    case 'paymaya':
      return 'PayMaya';
    case 'card':
      return 'Credit/Debit Card';
    case 'online_payment':
      return 'Online Payment';
    default:
      return 'Online Payment';
  }
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Paymongo-Signature');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const event = req.body;
    console.log('PayMongo webhook received:', event);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.attributes;
      const orderId = (session.metadata && session.metadata.orderId) || 
                     (session.description && 
                      session.description.match(/Order #(.+)/) && 
                      session.description.match(/Order #(.+)/)[1]);

      if (orderId) {
        console.log(`Processing successful payment for order: ${orderId}`);
        console.log('Session data:', JSON.stringify(session, null, 2));
        
        // Determine payment method from session (normalized slug)
        let paymentMethod = 'online_payment';
        
        // Try to get the actual payment method used
        if (session.payment_method_types && session.payment_method_types.length > 0) {
          paymentMethod = String(session.payment_method_types[0]).toLowerCase();
        }
        
        // Check if there's a payment intent with more specific payment method info
        if (session.payment_intent_id) {
          try {
            // Get payment intent details to find the actual payment method used
            const paymentIntentResponse = await fetch(`https://api.paymongo.com/v1/payment_intents/${session.payment_intent_id}`, {
              headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET}:`).toString('base64')}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (paymentIntentResponse.ok) {
              const paymentIntentData = await paymentIntentResponse.json();
              console.log('Payment intent data:', JSON.stringify(paymentIntentData, null, 2));
              
              // Check for the actual payment method used
              if (paymentIntentData.data && paymentIntentData.data.attributes) {
                const attributes = paymentIntentData.data.attributes;
                
                if (attributes.payment_method_allowed && attributes.payment_method_allowed.length > 0) {
                  paymentMethod = String(attributes.payment_method_allowed[0]).toLowerCase();
                }
                
                if (attributes.payment_method) {
                  paymentMethod = String(attributes.payment_method).toLowerCase();
                }
              }
            }
          } catch (error) {
            console.log('Error fetching payment intent:', error);
          }
        }
        
        console.log(`Determined payment method: ${paymentMethod}`);

        // Get temporary order data
        const tempOrderDoc = await admin.firestore()
            .collection('temp_orders')
            .doc(orderId)
            .get();

        if (tempOrderDoc.exists) {
          const orderData = tempOrderDoc.data();
          console.log('Found temporary order data:', orderData);
          
          // Create individual orders for each cart item
          const batch = admin.firestore().batch();
          const ordersRef = admin.firestore().collection('orders');

          for (const item of orderData.cartItems) {
            const orderDoc = ordersRef.doc();
            batch.set(orderDoc, {
              'buyerId': orderData.buyerId,
              'buyerName': orderData.buyerName,
              'productId': item.productId,
              'sellerId': item.sellerId,
              'productName': item.name,
              'quantity': item.quantity,
              'unit': item.unit,
              'price': item.price,
              'status': 'completed',
              'createdAt': admin.firestore.FieldValue.serverTimestamp(),
              // Store normalized slug so clients can map to friendly names
              'paymentMethod': paymentMethod,
              'paymentStatus': 'completed',
              'paymentAmount': orderData.amount,
              'originalAmount': orderData.originalAmount || orderData.amount,
              'discountAmount': orderData.discountAmount || 0.0,
              'hasPromoApplied': orderData.hasPromoApplied || false,
              'promoType': orderData.promoType,
              'paymentDate': admin.firestore.FieldValue.serverTimestamp(),
              'imageUrl': item.imageUrl,
              'supplierName': item.supplierName,
              'orderId': orderId,
              'totalAmount': orderData.amount,
              'completedAt': admin.firestore.FieldValue.serverTimestamp(),
              'updatedAt': admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          // Commit the batch to create all orders
          await batch.commit();
          console.log(`Created ${orderData.cartItems.length} orders for orderId: ${orderId}`);

          // Remove items from cart
          if (orderData.cartItems && Array.isArray(orderData.cartItems)) {
            const cartBatch = admin.firestore().batch();
            
            for (const item of orderData.cartItems) {
              if (item.cartDocId) {
                const cartDocRef = admin.firestore()
                    .collection('users')
                    .doc(orderData.buyerId)
                    .collection('cart')
                    .doc(item.cartDocId);
                
                cartBatch.delete(cartDocRef);
              }
            }
            
            await cartBatch.commit();
            console.log(`Removed cart items for order ${orderId}`);
          }

          // Delete temporary order
          await admin.firestore()
              .collection('temp_orders')
              .doc(orderId)
              .delete();

          console.log(`Order ${orderId} completed via webhook`);
        } else {
          console.log(`No temporary order found for orderId: ${orderId}`);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayMongo webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
