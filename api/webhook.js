// api/webhook.js
// Stripe Webhook を受信し、payment_intent.succeeded 時に mint-nft を呼び出す
// POST /api/webhook  （Stripe Dashboard に登録するエンドポイント）
//
// ⚠️  Vercel では body の raw bytes が必要なため、bodyParser を無効にする
//     vercel.json の routes に "api/webhook" を raw body 設定すること

import Stripe from 'stripe';

// ★ トップレベルで new Stripe() しない

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host']  || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Stripe環境変数が未設定です' });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const sig        = req.headers['stripe-signature'];
  const rawBody    = await getRawBody(req);
  let event;

  // ── 署名検証 ──────────────────────────────────────────────────────
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[webhook] 署名検証失敗:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // ── payment_intent.succeeded のみ処理 ────────────────────────────
  if (event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true, skipped: event.type });
  }

  const paymentIntent = event.data.object;
  const meta          = paymentIntent.metadata || {};

  // kouoh_purchase 以外は無視
  if (meta.type !== 'kouoh_purchase') {
    return res.status(200).json({ received: true, skipped: 'not kouoh_purchase' });
  }

  console.log('[webhook] kouoh_purchase 受信:', paymentIntent.id);

  // ── webhook では "購入済み" フラグを記録するだけ ──────────────────
  // NFT 発行には購入者のメールアドレスが必要。
  // メールはフロントの doMintNFT() で入力されるため、
  // webhook 側では PaymentIntent に "payment_confirmed" を付与し、
  // mint-nft は直接 POST で呼ばれる設計とする。
  //
  // ただし「メールアドレスを PaymentIntent に付与してから決済する」
  // フローに変更する場合は、以下のコメントアウトを外せば
  // webhook から自動 mint も可能。
  //
  // ──────────────────────────────────────────────────────────────────
  // const email = meta.email;
  // if (email) {
  //   await triggerMintNFT({ email, meta, paymentIntent, req });
  // }
  // ──────────────────────────────────────────────────────────────────

  // PaymentIntent の metadata に "payment_confirmed" を追記（任意）
  try {
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: { ...meta, payment_confirmed: 'true' },
    });
  } catch (e) {
    console.warn('[webhook] metadata 更新スキップ:', e.message);
  }

  return res.status(200).json({ received: true, paymentIntentId: paymentIntent.id });
}


// ── 将来的に webhook から自動 mint する場合の関数（現在は未使用） ────
// async function triggerMintNFT({ email, meta, paymentIntent, req }) {
//   const baseUrl = getBaseUrl(req);
//   const body = {
//     email,
//     product:         meta.product   || '誰が袖 空蝉香',
//     scentType:       meta.scentType || 'utsusemi',
//     storeName:       '香老舗 松栄堂',
//     date:            new Date().toLocaleDateString('ja-JP'),
//     amount:          paymentIntent.amount,
//     quantity:        Number(meta.quantity) || 1,
//     paymentIntentId: paymentIntent.id,
//   };
//   const res = await fetch(`${baseUrl}/api/mint-nft`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify(body),
//   });
//   const data = await res.json();
//   console.log('[webhook] mint-nft 結果:', data);
// }
