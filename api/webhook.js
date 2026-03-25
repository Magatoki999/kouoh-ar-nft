import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Stripeの署名を検証（なりすまし防止）
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook署名エラー:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // 決済完了イベントを処理
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const amount = paymentIntent.amount;
    const txId = paymentIntent.id;

    console.log(`✅ 購入受付: ${amount}円 / TX: ${txId}`);

    // ★ ここにJPYC送金処理を追加予定
    // await sendJPYC({ to: SHRINE_WALLET, amount, txId });

    // ★ ここにDB保存処理を追加予定
    // await saveRecord({ txId, amount, timestamp: new Date() });
  }

  return res.status(200).json({ received: true });
}

// Stripeの署名検証にはRaw Bodyが必要
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export const config = {
  api: {
    bodyParser: false,  // Raw Bodyを取得するために必須
  },
};