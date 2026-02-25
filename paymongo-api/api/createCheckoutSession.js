const axios = require('axios');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const secret = process.env.PAYMONGO_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Missing PayMongo secret' });
    }

    const {
      amount,
      description,
      customerName,
      customerEmail,
      customerPhone,
      successUrl,
      cancelUrl,
      lineItems,
      metadata,
    } = req.body;

    if (!amount || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: 'amount, successUrl, and cancelUrl are required',
      });
    }

    const resolvedLineItems = Array.isArray(lineItems) && lineItems.length > 0
      ? lineItems
      : [
          {
            name: description || 'VeggieConnect order',
            amount: Number(amount),
            currency: 'PHP',
            quantity: 1,
          },
        ];

    const payload = {
      data: {
        attributes: {
          amount: Number(amount),
          currency: 'PHP',
          description: description || 'VeggieConnect payment',
          payment_method_types: ['gcash', 'grab_pay', 'paymaya', 'card'],
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          line_items: resolvedLineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: metadata || {},
          billing: {
            name: customerName || 'Guest',
            email: customerEmail || 'guest@example.com',
            phone: customerPhone || '',
          },
        },
      },
    };

    const response = await axios.post(
        'https://api.paymongo.com/v1/checkout_sessions',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
          },
          timeout: 15000,
        },
    );

    const checkoutUrl = response?.data?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }

    return res.status(200).json({ checkout_url: checkoutUrl });
  } catch (err) {
    console.error('PayMongo API Error:', err.response?.data || err.message);
    const message = err.response?.data || err.message || 'Unknown error';
    return res.status(500).json({ error: message });
  }
};
