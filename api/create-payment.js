import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, method } = req.body;

  if (!amount || amount < 100) {
    return res.status(400).json({ error: '金額が不正です' });
  }

  try {
    // Stripe Payment Intentを生成
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,          // 円単位
      currency: 'jpy',         // 日本円
      payment_method_types: ['card'],
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' }
      },
      metadata: {
        method: method,
        app: 'kouoh-ar-nft'
      }
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,  // フロントに返す
      txId: paymentIntent.id,
      amount: amount
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '決済の初期化に失敗しました' });
  }
}