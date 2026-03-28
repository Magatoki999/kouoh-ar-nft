// api/create-payment.js
// Stripe PaymentIntent を生成して clientSecret を返す
// POST /api/create-payment
// body: { amount, scentType, product, quantity }

import Stripe from 'stripe';

// ★ トップレベルで new Stripe() しない（環境変数未設定時にクラッシュするため）

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: '環境変数 STRIPE_SECRET_KEY が未設定です' });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const {
      amount    = 440,
      scentType = 'utsusemi',
      product   = '空蝉',
      quantity  = 1,
    } = req.body;

    // 最低金額チェック（Stripe は ¥50 以上）
    if (!Number.isInteger(amount) || amount < 50) {
      return res.status(400).json({ error: '金額が不正です' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'jpy',
      // ── Webhook で mint-nft に渡すメタデータ ──────────────────────
      // webhook.js が payment_intent.succeeded を受け取ったとき、
      // このメタデータを使って mint-nft.js を呼び出す。
      // ただし NFT 発行には email が必要なため、
      // webhook では "purchased" フラグを立てるだけにとどめ、
      // フロント側の doMintNFT() から直接 mint-nft を呼ぶ設計とする。
      metadata: {
        type:      'kouoh_purchase',
        product,
        scentType,
        quantity:  String(quantity),
        purchased_at: new Date().toISOString(),
      },
      // 自動確認（フロント confirmCardPayment と対応）
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (err) {
    console.error('[create-payment] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
