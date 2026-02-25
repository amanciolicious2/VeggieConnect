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
        
        // Determine payment method from session
        let paymentMethod = 'online_payment';
        if (session.payment_method_types && session.payment_method_types.length > 0) {
          const usedMethod = session.payment_method_types[0];
          paymentMethod = usedMethod;
        }

        // Call the complete order function
        const completeOrderResponse = await admin.firestore()
            .collection('temp_orders')
            .doc(orderId)
            .get();

        if (completeOrderResponse.exists) {
          // Trigger order completion
          const orderData = completeOrderResponse.data();
          
          const orderDataFinal = {
            orderId: orderId,
            buyerId: orderData.buyerId,
            buyerName: orderData.buyerName,
            items: orderData.cartItems,
            totalAmount: orderData.amount,
            paymentMethod: paymentMethod,
            paymentStatus: 'paid',
            orderStatus: 'confirmed',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          // Save order to orders collection
          await admin.firestore()
              .collection('orders')
              .doc(orderId)
              .set(orderDataFinal);

          // Remove items from cart
          if (orderData.cartItems && Array.isArray(orderData.cartItems)) {
            const batch = admin.firestore().batch();
            
            for (const item of orderData.cartItems) {
              if (item.cartDocId) {
                const cartDocRef = admin.firestore()
                    .collection('carts')
                    .doc(orderData.buyerId)
                    .collection('items')
                    .doc(item.cartDocId);
                
                batch.delete(cartDocRef);
              }
            }
            
            await batch.commit();
          }

          // Delete temporary order
          await admin.firestore()
              .collection('temp_orders')
              .doc(orderId)
              .delete();

          console.log(`Order ${orderId} completed via webhook`);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayMongo webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
