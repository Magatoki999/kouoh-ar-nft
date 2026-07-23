// api/admin.js
// 管理画面用API
import Stripe from 'stripe';

// ★リセットしたい日時を指定（この時間より前のデータは非表示になります）
const RESET_TIMESTAMP = new Date('2026-04-15T15:00:00+09:00').getTime() / 1000;

function getNormalizedProduct(meta) {
  if (!meta) return '空蝉';
  const val = String(meta.product || meta.scentType || meta.kouoh_type || '').toLowerCase();
  if (val.includes('yugao') || val.includes('夕顔')) return '夕顔';
  return '空蝉';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { action, password, limit = '50', starting_after } = req.query;

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD が未設定です' });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '認証に失敗しました' });

  if (action === 'verify') return res.status(200).json({ ok: true });

  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'STRIPE_SECRET_KEY が未設定です' });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    if (action === 'payments') {
      const params = { limit: Math.min(parseInt(limit) || 50, 100) };
      if (starting_after) params.starting_after = starting_after;

      const intents = await stripe.paymentIntents.list(params);

      // ★過去のテストデータを弾く（RESET_TIMESTAMP以降のみ残す）
      const validIntents = intents.data.filter(pi => pi.created >= RESET_TIMESTAMP);

      const rows = validIntents.map(function(pi) {
        const meta = pi.metadata || {};
        const productName = getNormalizedProduct(meta);

        return {
          id:          pi.id,
          status:      pi.status,
          amount:      pi.amount,
          currency:    pi.currency,
          created:     pi.created,
          email:       meta.email       || '',
          product:     productName,
          scentType:   productName === '夕顔' ? 'yugao' : 'utsusemi',
          storeName:   meta.storeName   || '',
          quantity:    meta.quantity    || '',
          season:      meta.season      || '',
          weather:     meta.weather     || '',
          timeOfDay:   meta.timeOfDay   || '',
          txHash:      meta.txHash      || '',
          tokenId:     meta.tokenId     || '',
          wallet:      meta.wallet      || '',
          nftMinted:   meta.nftMinted === 'true',
        };
      });

      return res.status(200).json({
        data:     rows,
        has_more: intents.has_more,
        last_id:  validIntents.length > 0 ? validIntents[validIntents.length - 1].id : null,
      });
    }

    if (action === 'stats') {
      const intents = await stripe.paymentIntents.list({ limit: 100 });
      
      // ★過去のテストデータを弾く（RESET_TIMESTAMP以降のみ残す）
      const validIntents = intents.data.filter(pi => pi.created >= RESET_TIMESTAMP);
      const succeeded = validIntents.filter(pi => pi.status === 'succeeded');

      const totalAmount = succeeded.reduce((s, pi) => s + pi.amount, 0);
      const totalCount  = succeeded.length;

      function countBy(key) {
        var map = {};
        succeeded.forEach(function(pi) {
          var v = (pi.metadata || {})[key];
          if (key === 'product') v = getNormalizedProduct(pi.metadata);
          if (!v || v === 'unknown') return;
          map[v] = (map[v] || 0) + 1;
        });
        return map;
      }

      function amountBy(key) {
        var map = {};
        succeeded.forEach(function(pi) {
          var v = (pi.metadata || {})[key];
          if (key === 'product') v = getNormalizedProduct(pi.metadata);
          if (!v) v = 'unknown';
          map[v] = (map[v] || 0) + pi.amount;
        });
        return map;
      }

      var dailyMap = {};
      succeeded.forEach(function(pi) {
        var d = new Date(pi.created * 1000);
        var key = d.getFullYear() + '-'
          + String(d.getMonth() + 1).padStart(2, '0') + '-'
          + String(d.getDate()).padStart(2, '0');
        if (!dailyMap[key]) dailyMap[key] = { count: 0, amount: 0 };
        dailyMap[key].count++;
        dailyMap[key].amount += pi.amount;
      });

      return res.status(200).json({
        totalAmount,
        totalCount,
        nftMintedCount: succeeded.filter(pi => pi.metadata?.nftMinted === 'true').length,
        bySeason:    countBy('season'),
        byWeather:   countBy('weather'),
        byTimeOfDay: countBy('timeOfDay'),
        byProduct:   countBy('product'),
        amountByProduct: amountBy('product'),
        daily: dailyMap,
      });
    }

    return res.status(400).json({ error: '不明なaction' });

  } catch (err) {
    console.error('[admin]', err);
    return res.status(500).json({ error: err.message });
  }
}