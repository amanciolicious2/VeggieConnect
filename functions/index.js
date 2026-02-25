const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();
// Helper: send supplier notifications (FCM + in-app) for new order
async function notifySuppliersOfNewOrder(orderId, cartItems) {
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) return;
  try {
    const now = admin.firestore.Timestamp.now();
    const notifiedSupplierIds = new Set();

    for (const item of cartItems) {
      const supplierId = item.sellerId || item.supplierId;
      if (!supplierId || notifiedSupplierIds.has(supplierId)) continue;
      notifiedSupplierIds.add(supplierId);

      // Fetch supplier user to get fcmToken
      const supplierDoc = await admin.firestore().collection('users').doc(supplierId).get();
      const supplierData = supplierDoc.exists ? supplierDoc.data() : null;
      const singleToken = supplierData && supplierData.fcmToken;
      const multiTokens = (supplierData && Array.isArray(supplierData.fcmTokens)) ? supplierData.fcmTokens.filter(Boolean) : [];

      const title = 'New Order Received!';
      const body = `You have a new order #${String(orderId).substring(0, 8)} from a customer.`;

      // Send FCM push
      const tokensToSend = multiTokens.length > 0 ? multiTokens : (singleToken ? [singleToken] : []);
      if (tokensToSend.length > 0) {
        if (tokensToSend.length === 1) {
          const message = {
            token: tokensToSend[0],
            notification: { title, body },
            data: {
              type: 'order_update',
              orderId: String(orderId),
              status: 'pending',
              action: 'new_order',
              screen: 'supplier_orders',
              recipientId: supplierId,
            },
            android: {
              notification: { channelId: 'orders', priority: 'high', sound: 'default' },
            },
            apns: {
              payload: {
                aps: {
                  alert: { title, body },
                  sound: 'default',
                  badge: 1,
                },
              },
            },
          };
          await admin.messaging().send(message);
        } else {
          const multicast = {
            tokens: tokensToSend,
            notification: { title, body },
            data: {
              type: 'order_update',
              orderId: String(orderId),
              status: 'pending',
              action: 'new_order',
              screen: 'supplier_orders',
              recipientId: supplierId,
            },
            android: {
              notification: { channelId: 'orders', priority: 'high', sound: 'default' },
            },
            apns: {
              payload: {
                aps: {
                  alert: { title, body },
                  sound: 'default',
                  badge: 1,
                },
              },
            },
          };
          await admin.messaging().sendMulticast(multicast);
        }
      } else {
        console.warn(`No FCM token(s) found for supplier ${supplierId} while notifying for order ${orderId}`);
      }

      // Create in-app notification in user's notification center
      await admin.firestore()
        .collection('users')
        .doc(supplierId)
        .collection('notifications')
        .add({
          title,
          body,
          type: 'order_update',
          data: {
            orderId: String(orderId),
            status: 'pending',
            action: 'new_order',
            screen: 'supplier_orders',
            recipientId: supplierId,
          },
          isRead: false,
          showBadge: true,
          priority: 'high',
          timestamp: now,
          createdAt: now,
        });
    }
  } catch (e) {
    console.error('Error notifying suppliers of new order:', e);
  }
}
// Maintain product favoriteCount based on user favorites subcollection
exports.onFavoriteCreated = functions.firestore
  .document('users/{userId}/favorites/{productId}')
  .onCreate(async (snap, context) => {
    const productId = context.params.productId;
    const productRef = admin.firestore().collection('products').doc(productId);
    await admin.firestore().runTransaction(async (tx) => {
      const doc = await tx.get(productRef);
      if (!doc.exists) return;
      const current = (doc.data().favoriteCount || 0);
      tx.update(productRef, {
        favoriteCount: current + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    return null;
  });

exports.onFavoriteDeleted = functions.firestore
  .document('users/{userId}/favorites/{productId}')
  .onDelete(async (snap, context) => {
    const productId = context.params.productId;
    const productRef = admin.firestore().collection('products').doc(productId);
    await admin.firestore().runTransaction(async (tx) => {
      const doc = await tx.get(productRef);
      if (!doc.exists) return;
      const current = (doc.data().favoriteCount || 0);
      const next = Math.max(0, current - 1);
      tx.update(productRef, {
        favoriteCount: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    return null;
  });

// Cloud Function to send FCM notifications using V1 API
exports.sendNotification = functions.https.onCall(async (data, context) => {
  try {
    // Validate input
    if (!data.token || !data.title || !data.body) {
      throw new functions.https.HttpsError('invalid-argument',
        'Missing required fields');
    }

    // Prepare the message for FCM V1 API
    const message = {
      token: data.token,
      notification: {
        title: data.title,
        body: data.body,
      },
      data: {
        type: data.type || 'general',
        ...data.customData,
      },
      android: {
        notification: {
          channelId: getChannelIdForType(data.type || 'general'),
          priority: 'high',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: data.title,
              body: data.body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    // Send the notification using FCM V1 API
    const response = await admin.messaging().send(message);

    console.log('Successfully sent message:', response);

    return {
      success: true,
      messageId: response,
    };
  } catch (error) {
    console.error('Error sending message:', error);
    throw new functions.https.HttpsError('internal',
      'Failed to send notification');
  }
});

/**
 * Helper function to get channel ID based on notification type
 * @param {string} type The notification type
 * @return {string} The channel ID
 */
function getChannelIdForType(type) {
  switch (type) {
  case 'order_update':
  case 'order':
    return 'orders';
  case 'chat':
    return 'chat';
  default:
    return 'general';
  }
}

// Cloud Function to send notification to multiple users
exports.sendNotificationToMultiple = functions.https.onCall(
  async (data, context) => {
    try {
      if (!data.tokens || !Array.isArray(data.tokens) ||
            !data.title || !data.body) {
        throw new functions.https.HttpsError('invalid-argument',
          'Missing required fields');
      }

      const message = {
        tokens: data.tokens,
        notification: {
          title: data.title,
          body: data.body,
        },
        data: {
          type: data.type || 'general',
          ...data.customData,
        },
        android: {
          notification: {
            channelId: getChannelIdForType(data.type || 'general'),
            priority: 'high',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: data.title,
                body: data.body,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendMulticast(message);

      console.log('Successfully sent multicast message:', response);

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses,
      };
    } catch (error) {
      console.error('Error sending multicast message:', error);
      throw new functions.https.HttpsError('internal',
        'Failed to send notifications');
    }
  });

// Cloud Function to complete order after successful payment
exports.completeOrder = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { orderId, paymentMethod, status } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    console.log(`Processing order completion for orderId: ${orderId}`);

    // Get temporary order data
    const tempOrderDoc = await admin.firestore()
      .collection('temp_orders')
      .doc(orderId)
      .get();

    if (!tempOrderDoc.exists) {
      console.log(`No temporary order found for orderId: ${orderId}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    const tempOrderData = tempOrderDoc.data();
    console.log('Temporary order data:', tempOrderData);

    // Create the actual order in Firestore
    const orderData = {
      orderId: orderId,
      buyerId: tempOrderData.buyerId,
      buyerName: tempOrderData.buyerName,
      items: tempOrderData.cartItems,
      totalAmount: tempOrderData.amount,
      paymentMethod: paymentMethod || 'online_payment',
      paymentStatus: status === 'success' ? 'paid' : 'failed',
      orderStatus: status === 'success' ? 'confirmed' : 'cancelled',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save order to orders collection
    await admin.firestore()
      .collection('orders')
      .doc(orderId)
      .set(orderData);

    console.log(`Order ${orderId} created successfully`);

    // Remove items from cart for each cart item
    if (tempOrderData.cartItems && Array.isArray(tempOrderData.cartItems)) {
      const batch = admin.firestore().batch();

      for (const item of tempOrderData.cartItems) {
        if (item.cartDocId) {
          const cartDocRef = admin.firestore()
            .collection('carts')
            .doc(tempOrderData.buyerId)
            .collection('items')
            .doc(item.cartDocId);

          batch.delete(cartDocRef);
        }
      }

      await batch.commit();
      console.log(`Cart items removed for order ${orderId}`);
    }

    // Delete temporary order
    await admin.firestore()
      .collection('temp_orders')
      .doc(orderId)
      .delete();

    console.log(`Temporary order ${orderId} cleaned up`);

    // Notify suppliers of this new order (FCM + Notification Center)
    try {
      await notifySuppliersOfNewOrder(orderId, tempOrderData.cartItems);
      console.log('Supplier notifications dispatched for', orderId);
    } catch (e) {
      console.error('Failed to notify suppliers:', e);
    }

    // Send notification to buyer
    try {
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(tempOrderData.buyerId)
        .get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;

        if (fcmToken) {
          const message = {
            token: fcmToken,
            notification: {
              title: status === 'success' ? 'Order Confirmed!' : 'Payment Failed',
              body: status === 'success' ?
                `Your order #${orderId.substring(0, 8)} has been confirmed.` :
                `Payment for order #${orderId.substring(0, 8)} failed.`,
            },
            data: {
              type: 'order_update',
              orderId: orderId,
              status: status,
            },
            android: {
              notification: {
                channelId: 'orders',
                priority: 'high',
                sound: 'default',
              },
            },
          };

          await admin.messaging().send(message);
          console.log(`Notification sent for order ${orderId}`);
        }
      }
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Don't fail the order completion if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Order completed successfully',
      orderId: orderId,
    });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete order',
      details: error.message,
    });
  }
});

// PayMongo webhook handler
exports.paymongoWebhook = functions.https.onRequest(async (req, res) => {
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

          // Notify customer (buyer) of successful order confirmation
          try {
            const buyerDoc = await admin.firestore()
              .collection('users')
              .doc(orderData.buyerId)
              .get();

            if (buyerDoc.exists) {
              const buyerData = buyerDoc.data();
              const singleToken = buyerData && buyerData.fcmToken;
              const multiTokens = (buyerData && Array.isArray(buyerData.fcmTokens)) ? buyerData.fcmTokens.filter(Boolean) : [];

              const title = 'Order Confirmed!';
              const body = `Your order #${String(orderId).substring(0, 8)} has been confirmed.`;

              const tokensToSend = multiTokens.length > 0 ? multiTokens : (singleToken ? [singleToken] : []);
              if (tokensToSend.length === 1) {
                const message = {
                  token: tokensToSend[0],
                  notification: { title, body },
                  data: {
                    type: 'order_update',
                    orderId: String(orderId),
                    status: 'success',
                    screen: 'order_details',
                  },
                  android: {
                    notification: { channelId: 'orders', priority: 'high', sound: 'default' },
                  },
                };
                await admin.messaging().send(message);
              } else if (tokensToSend.length > 1) {
                const multicast = {
                  tokens: tokensToSend,
                  notification: { title, body },
                  data: {
                    type: 'order_update',
                    orderId: String(orderId),
                    status: 'success',
                    screen: 'order_details',
                  },
                  android: {
                    notification: { channelId: 'orders', priority: 'high', sound: 'default' },
                  },
                };
                await admin.messaging().sendMulticast(multicast);
              } else {
                console.warn(`No FCM token(s) found for buyer ${orderData.buyerId} for order ${orderId}`);
              }

              // Create in-app notification entry for buyer
              const nowTs = admin.firestore.Timestamp.now();
              await admin.firestore()
                .collection('users')
                .doc(orderData.buyerId)
                .collection('notifications')
                .add({
                  title,
                  body,
                  type: 'order_update',
                  data: {
                    orderId: String(orderId),
                    status: 'success',
                    screen: 'order_details',
                  },
                  isRead: false,
                  showBadge: true,
                  priority: 'high',
                  timestamp: nowTs,
                  createdAt: nowTs,
                });
            }
          } catch (e) {
            console.error('Failed to notify customer (webhook):', e);
          }

          // Notify suppliers of this new order triggered by webhook completion
          try {
            await notifySuppliersOfNewOrder(orderId, orderData.cartItems);
            console.log('Supplier notifications dispatched via webhook for', orderId);
          } catch (e) {
            console.error('Failed to notify suppliers (webhook):', e);
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayMongo webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Cloud Function for real-time supplier ban management
exports.processSupplierBan = functions.firestore
  .document('supplier_reports/{reportId}')
  .onCreate(async (snap, context) => {
    try {
      const reportData = snap.data();
      const supplierId = reportData.supplierId;

      console.log(`Processing new report for supplier: ${supplierId}`);

      // Count total reports for this supplier
      const reportsSnapshot = await admin.firestore()
        .collection('supplier_reports')
        .where('supplierId', '==', supplierId)
        .get();

      const reportCount = reportsSnapshot.docs.length;
      console.log(`Supplier ${supplierId} now has ${reportCount} reports`);

      // Auto-ban if 3 or more reports
      if (reportCount >= 3) {
        const now = admin.firestore.Timestamp.now();

        // Update supplier status to banned
        await admin.firestore()
          .collection('users')
          .doc(supplierId)
          .update({
            isBanned: true,
            bannedAt: now,
            banReason: `Automatically banned due to ${reportCount} customer reports`,
            bannedBy: 'system_auto_ban',
            updatedAt: now,
          });

        // Deactivate all supplier's products
        const supplierProducts = await admin.firestore()
          .collection('products')
          .where('sellerId', '==', supplierId)
          .get();

        const batch = admin.firestore().batch();
        supplierProducts.docs.forEach((doc) => {
          batch.update(doc.ref, {
            isActive: false,
            deactivatedAt: now,
            deactivationReason: 'Supplier banned due to multiple reports',
          });
        });

        await batch.commit();
        console.log(`Banned supplier ${supplierId} and deactivated ${supplierProducts.docs.length} products`);

        // Send notification to banned supplier
        try {
          const supplierDoc = await admin.firestore()
            .collection('users')
            .doc(supplierId)
            .get();

          if (supplierDoc.exists) {
            const supplierData = supplierDoc.data();
            const fcmToken = supplierData.fcmToken;

            if (fcmToken) {
              const message = {
                token: fcmToken,
                notification: {
                  title: 'Account Suspended',
                  body: 'Your supplier account has been suspended due to multiple customer reports. Please contact support for assistance.',
                },
                data: {
                  type: 'account_banned',
                  reason: 'multiple_reports',
                  screen: 'supplier_profile',
                },
                android: {
                  notification: {
                    channelId: 'account',
                    priority: 'high',
                    sound: 'default',
                  },
                },
              };

              await admin.messaging().send(message);
            }

            // Create in-app notification
            await admin.firestore()
              .collection('users')
              .doc(supplierId)
              .collection('notifications')
              .add({
                title: 'Account Suspended',
                body: 'Your supplier account has been suspended due to multiple customer reports. Please contact support for assistance.',
                type: 'account_banned',
                data: {
                  reason: 'multiple_reports',
                  reportCount: reportCount,
                  screen: 'supplier_profile',
                },
                isRead: false,
                createdAt: now,
              });
          }
        } catch (notificationError) {
          console.error('Error sending ban notification to supplier:', notificationError);
        }

        // Notify admins about the auto-ban
        try {
          const adminUsers = await admin.firestore()
            .collection('users')
            .where('role', '==', 'admin')
            .get();

          const adminTokens = [];
          const adminNotifications = [];

          adminUsers.docs.forEach((doc) => {
            const adminData = doc.data();
            if (adminData.fcmToken) {
              adminTokens.push(adminData.fcmToken);
            }

            adminNotifications.push(
              admin.firestore()
                .collection('users')
                .doc(doc.id)
                .collection('notifications')
                .add({
                  title: 'Supplier Auto-Banned',
                  body: `Supplier ${reportData.supplierName || supplierId} has been automatically banned due to ${reportCount} reports.`,
                  type: 'admin_supplier_banned',
                  data: {
                    supplierId: supplierId,
                    reportCount: reportCount,
                    screen: 'admin_reports',
                  },
                  isRead: false,
                  createdAt: now,
                }),
            );
          });

          if (adminTokens.length > 0) {
            const adminMessage = {
              tokens: adminTokens,
              notification: {
                title: 'Supplier Auto-Banned',
                body: `Supplier ${reportData.supplierName || supplierId} has been automatically banned due to ${reportCount} reports.`,
              },
              data: {
                type: 'admin_supplier_banned',
                supplierId: supplierId,
                reportCount: reportCount.toString(),
                screen: 'admin_reports',
              },
              android: {
                notification: {
                  channelId: 'admin',
                  priority: 'high',
                  sound: 'default',
                },
              },
            };

            await admin.messaging().sendMulticast(adminMessage);
            console.log(`Auto-ban notification sent to ${adminTokens.length} admins`);
          }

          await Promise.all(adminNotifications);
        } catch (adminNotificationError) {
          console.error('Error sending admin ban notifications:', adminNotificationError);
        }
      } else {
        // Send warning notification to supplier if approaching ban threshold
        if (reportCount === 2) {
          try {
            const supplierDoc = await admin.firestore()
              .collection('users')
              .doc(supplierId)
              .get();

            if (supplierDoc.exists) {
              const supplierData = supplierDoc.data();
              const fcmToken = supplierData.fcmToken;

              if (fcmToken) {
                const message = {
                  token: fcmToken,
                  notification: {
                    title: 'Account Warning',
                    body: 'You have received multiple customer reports. One more report may result in account suspension. Please review your service quality.',
                  },
                  data: {
                    type: 'account_warning',
                    reportCount: reportCount.toString(),
                    screen: 'supplier_profile',
                  },
                  android: {
                    notification: {
                      channelId: 'account',
                      priority: 'high',
                      sound: 'default',
                    },
                  },
                };

                await admin.messaging().send(message);
              }

              // Create in-app notification
              await admin.firestore()
                .collection('users')
                .doc(supplierId)
                .collection('notifications')
                .add({
                  title: 'Account Warning',
                  body: 'You have received multiple customer reports. One more report may result in account suspension. Please review your service quality.',
                  type: 'account_warning',
                  data: {
                    reportCount: reportCount,
                    screen: 'supplier_profile',
                  },
                  isRead: false,
                  createdAt: admin.firestore.Timestamp.now(),
                });
            }
          } catch (warningError) {
            console.error('Error sending warning notification:', warningError);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error processing supplier ban:', error);
      throw error;
    }
  });

// Cloud Function to unban suppliers (callable by admins)
exports.unbanSupplier = functions.https.onCall(async (data, context) => {
  try {
    // Verify admin authentication
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Verify admin role
    const adminDoc = await admin.firestore()
      .collection('users')
      .doc(context.auth.uid)
      .get();

    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { supplierId, reason } = data;

    if (!supplierId) {
      throw new functions.https.HttpsError('invalid-argument', 'Supplier ID required');
    }

    const now = admin.firestore.Timestamp.now();

    // Update supplier status
    await admin.firestore()
      .collection('users')
      .doc(supplierId)
      .update({
        isBanned: false,
        unbannedAt: now,
        unbanReason: reason || 'Unbanned by admin',
        unbannedBy: context.auth.uid,
        updatedAt: now,
      });

    // Reactivate supplier's products
    const supplierProducts = await admin.firestore()
      .collection('products')
      .where('sellerId', '==', supplierId)
      .where('deactivationReason', '==', 'Supplier banned due to multiple reports')
      .get();

    const batch = admin.firestore().batch();
    supplierProducts.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isActive: true,
        reactivatedAt: now,
        reactivationReason: 'Supplier unbanned by admin',
      });
    });

    await batch.commit();

    console.log(`Supplier ${supplierId} unbanned by admin ${context.auth.uid}`);

    // Send notification to unbanned supplier
    try {
      const supplierDoc = await admin.firestore()
        .collection('users')
        .doc(supplierId)
        .get();

      if (supplierDoc.exists) {
        const supplierData = supplierDoc.data();
        const fcmToken = supplierData.fcmToken;

        if (fcmToken) {
          const message = {
            token: fcmToken,
            notification: {
              title: 'Account Restored',
              body: 'Your supplier account has been restored. You can now access all supplier features and manage your products.',
            },
            data: {
              type: 'account_unbanned',
              screen: 'supplier_dashboard',
            },
            android: {
              notification: {
                channelId: 'account',
                priority: 'high',
                sound: 'default',
              },
            },
          };

          await admin.messaging().send(message);
        }

        // Create in-app notification
        await admin.firestore()
          .collection('users')
          .doc(supplierId)
          .collection('notifications')
          .add({
            title: 'Account Restored',
            body: 'Your supplier account has been restored. You can now access all supplier features and manage your products.',
            type: 'account_unbanned',
            data: {
              reason: reason || 'Unbanned by admin',
              screen: 'supplier_dashboard',
            },
            isRead: false,
            createdAt: now,
          });
      }
    } catch (notificationError) {
      console.error('Error sending unban notification:', notificationError);
    }

    return {
      success: true,
      message: 'Supplier unbanned successfully',
      productsReactivated: supplierProducts.docs.length,
    };
  } catch (error) {
    console.error('Error unbanning supplier:', error);
    throw new functions.https.HttpsError('internal', 'Failed to unban supplier');
  }
});

// Cloud Function for reliable 5-minute auto-approval of products (runs every 30 seconds)
exports.reliableAutoApproveProducts = functions.pubsub.schedule('every 30 seconds').onRun(async (context) => {
  console.log('Running reliable auto-approval check for products...');

  try {
    const now = admin.firestore.Timestamp.now();
    const fiveMinutesAgo = new Date(now.toDate().getTime() - (5 * 60 * 1000));

    // Query for pending products that should be auto-approved
    // Check both autoApprovalScheduledAt field and createdAt fallback
    const pendingProducts = await admin.firestore()
      .collection('products')
      .where('status', '==', 'pending')
      .get();

    console.log(`Found ${pendingProducts.docs.length} pending products to check`);

    const batch = admin.firestore().batch();
    const autoApprovedProducts = [];

    for (const doc of pendingProducts.docs) {
      const productData = doc.data();
      let shouldAutoApprove = false;

      // Check if product should be auto-approved
      if (productData.autoApprovalScheduledAt) {
        // Use scheduled time if available
        if (productData.autoApprovalScheduledAt.toDate() <= now.toDate()) {
          shouldAutoApprove = true;
        }
      } else if (productData.createdAt) {
        // Fallback: check if created more than 5 minutes ago
        if (productData.createdAt.toDate() <= fiveMinutesAgo) {
          shouldAutoApprove = true;
        }
      }

      if (shouldAutoApprove) {
        // Auto-approve the product
        batch.update(doc.ref, {
          status: 'approved',
          isVerified: true,
          isActive: true,
          reviewedAt: now,
          reviewedBy: 'system_auto_approval',
          rejectionReason: '',
          autoApproved: true,
          updatedAt: now,
          // Remove scheduling field
          autoApprovalScheduledAt: admin.firestore.FieldValue.delete(),
        });

        autoApprovedProducts.push({
          id: doc.id,
          name: productData.name || 'Unknown Product',
          supplierId: productData.sellerId || productData.supplierId,
          supplierName: productData.supplierName || 'Unknown Supplier',
        });
      }
    }

    // Commit all updates
    if (autoApprovedProducts.length > 0) {
      await batch.commit();
      console.log(`Reliably auto-approved ${autoApprovedProducts.length} products`);

      // Send FCM and in-app notifications to suppliers about auto-approved products
      for (const product of autoApprovedProducts) {
        try {
          // Get supplier's FCM token and user data
          const supplierDoc = await admin.firestore()
            .collection('users')
            .doc(product.supplierId)
            .get();

          if (supplierDoc.exists) {
            const supplierData = supplierDoc.data();
            const fcmToken = supplierData.fcmToken;

            // Send FCM push notification
            if (fcmToken) {
              const message = {
                token: fcmToken,
                notification: {
                  title: 'Product Approved!',
                  body: `Your product "${product.name}" has been automatically approved and is now live for customers.`,
                },
                data: {
                  type: 'product_auto_approved',
                  productId: product.id,
                  productName: product.name,
                  status: 'approved',
                  supplierId: product.supplierId,
                  screen: 'supplier_products',
                  recipientId: product.supplierId,
                },
                android: {
                  notification: {
                    channelId: 'products',
                    priority: 'high',
                    sound: 'default',
                  },
                },
                apns: {
                  payload: {
                    aps: {
                      alert: {
                        title: 'Product Approved!',
                        body: `Your product "${product.name}" has been automatically approved and is now live for customers.`,
                      },
                      sound: 'default',
                      badge: 1,
                    },
                  },
                },
              };

              await admin.messaging().send(message);
              console.log(`FCM notification sent for auto-approved product: ${product.name}`);
            }

            // Create in-app notification in Firestore for notification center
            await admin.firestore()
              .collection('users')
              .doc(product.supplierId)
              .collection('notifications')
              .add({
                title: 'Product Approved!',
                body: `Your product "${product.name}" has been automatically approved and is now live for customers.`,
                type: 'product_auto_approved',
                data: {
                  productId: product.id,
                  productName: product.name,
                  status: 'approved',
                  supplierId: product.supplierId,
                  screen: 'supplier_products',
                  recipientId: product.supplierId,
                },
                isRead: false,
                showBadge: true,
                priority: 'normal',
                timestamp: now,
                createdAt: now,
              });

            console.log(`In-app notification created for supplier: ${product.supplierId}`);
          }
        } catch (notificationError) {
          console.error(`Error sending notifications for product ${product.name}:`, notificationError);
        }
      }

      // Send summary notification to admins
      try {
        const adminUsers = await admin.firestore()
          .collection('users')
          .where('role', '==', 'admin')
          .get();

        const adminTokens = [];
        const adminNotifications = [];

        adminUsers.docs.forEach((doc) => {
          const adminData = doc.data();
          if (adminData.fcmToken) {
            adminTokens.push(adminData.fcmToken);
          }

          adminNotifications.push(
            admin.firestore()
              .collection('users')
              .doc(doc.id)
              .collection('notifications')
              .add({
                title: 'Product Auto-Approval Summary',
                body: `${autoApprovedProducts.length} product${autoApprovedProducts.length > 1 ? 's' : ''} automatically approved after 5 minutes.`,
                type: 'admin_product_auto_approval',
                data: {
                  count: autoApprovedProducts.length,
                  screen: 'admin_products',
                },
                isRead: false,
                timestamp: now,
                createdAt: now,
              }),
          );
        });

        if (adminTokens.length > 0) {
          const adminMessage = {
            tokens: adminTokens,
            notification: {
              title: 'Product Auto-Approval Summary',
              body: `${autoApprovedProducts.length} product${autoApprovedProducts.length > 1 ? 's' : ''} automatically approved after 5 minutes.`,
            },
            data: {
              type: 'admin_product_auto_approval',
              count: autoApprovedProducts.length.toString(),
              screen: 'admin_products',
            },
            android: {
              notification: {
                channelId: 'admin',
                priority: 'default',
                sound: 'default',
              },
            },
          };

          await admin.messaging().sendMulticast(adminMessage);
          console.log(`Product auto-approval summary sent to ${adminTokens.length} admins`);
        }

        await Promise.all(adminNotifications);
      } catch (adminNotificationError) {
        console.error('Error sending admin product auto-approval notifications:', adminNotificationError);
      }
    } else {
      console.log('No products found for reliable auto-approval');
    }

    return null;
  } catch (error) {
    console.error('Error in reliable product auto-approval function:', error);
    throw error;
  }
});

// Cloud Function to ban a supplier (callable by admins) with optional durationDays for temporary ban
exports.banSupplier = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const adminDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Must be admin');
    }

    const { supplierId, reason, durationDays } = data;
    if (!supplierId || !reason) {
      throw new functions.https.HttpsError('invalid-argument', 'supplierId and reason are required');
    }

    const now = admin.firestore.Timestamp.now();
    const isTemporary = Number.isInteger(durationDays) && durationDays > 0;
    const expiresAt = isTemporary ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)) : null;

    const banRef = await admin.firestore().collection('user_bans').add({
      userId: supplierId,
      bannedBy: context.auth.uid,
      reason,
      bannedAt: now,
      expiresAt: expiresAt,
      isPermanent: !isTemporary,
      isActive: true,
    });

    await admin.firestore().collection('users').doc(supplierId).update({
      isBanned: true,
      banType: isTemporary ? 'temporary' : 'permanent',
      banExpiresAt: expiresAt || admin.firestore.FieldValue.delete(),
      updatedAt: now,
    });

    const prods = await admin.firestore().collection('products').where('sellerId', '==', supplierId).get();
    const batch = admin.firestore().batch();
    prods.docs.forEach((doc) => batch.update(doc.ref, { isActive: false, deactivatedAt: now, deactivationReason: 'Supplier banned by admin' }));
    await batch.commit();

    return { success: true, banId: banRef.id };
  } catch (error) {
    console.error('Error banning supplier:', error);
    throw new functions.https.HttpsError('internal', 'Failed to ban supplier');
  }
});

// Scheduled job: unban users whose temporary bans have expired
exports.unbanExpiredBans = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  console.log('Running unbanExpiredBans...');
  try {
    const now = admin.firestore.Timestamp.now();
    const usersSnap = await admin.firestore()
      .collection('users')
      .where('isBanned', '==', true)
      .where('banType', '==', 'temporary')
      .where('banExpiresAt', '<=', now)
      .get();

    if (usersSnap.empty) {
      console.log('No expired bans found');
      return null;
    }

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const batch = admin.firestore().batch();

      const activeBans = await admin.firestore()
        .collection('user_bans')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();
      activeBans.docs.forEach((b) => batch.update(b.ref, { isActive: false }));

      batch.update(admin.firestore().collection('users').doc(userId), {
        isBanned: false,
        banType: admin.firestore.FieldValue.delete(),
        banExpiresAt: admin.firestore.FieldValue.delete(),
        updatedAt: now,
      });

      await batch.commit();
      console.log(`Unbanned user ${userId} due to expired temporary ban`);
    }

    return null;
  } catch (error) {
    console.error('Error in unbanExpiredBans:', error);
    throw error;
  }
});
