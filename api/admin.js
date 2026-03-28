// api/admin.js
// 管理画面用API
// GET  /api/admin?action=verify&password=xxx
// GET  /api/admin?action=payments&password=xxx&limit=50&starting_after=xxx
// GET  /api/admin?action=stats&password=xxx

import Stripe from 'stripe';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { action, password, limit = '50', starting_after } = req.query;

  // ── パスワード認証 ──────────────────────────────────────────────
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD が未設定です' });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '認証に失敗しました' });

  // verify のみ：認証確認だけして返す
  if (action === 'verify') {
    return res.status(200).json({ ok: true });
  }

  // ── Stripe 初期化 ────────────────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'STRIPE_SECRET_KEY が未設定です' });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    // ── 決済一覧 ────────────────────────────────────────────────────
    if (action === 'payments') {
      const params = {
        limit: Math.min(parseInt(limit) || 50, 100),
        expand: ['data.payment_method_details'],
      };
      if (starting_after) params.starting_after = starting_after;

      const intents = await stripe.paymentIntents.list(params);

      const rows = intents.data.map(function(pi) {
        const meta = pi.metadata || {};
        return {
          id:          pi.id,
          status:      pi.status,
          amount:      pi.amount,
          currency:    pi.currency,
          created:     pi.created,                    // unixtime
          email:       meta.email       || '',
          product:     meta.product     || '',
          scentType:   meta.scentType   || '',
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
        last_id:  intents.data.length > 0 ? intents.data[intents.data.length - 1].id : null,
      });
    }

    // ── 統計 ─────────────────────────────────────────────────────────
    if (action === 'stats') {
      // 最新200件で集計（十分なサンプル）
      const intents = await stripe.paymentIntents.list({ limit: 100 });
      const succeeded = intents.data.filter(function(pi) { return pi.status === 'succeeded'; });

      const totalAmount = succeeded.reduce(function(s, pi) { return s + pi.amount; }, 0);
      const totalCount  = succeeded.length;

      // 集計ヘルパー
      function countBy(key) {
        var map = {};
        succeeded.forEach(function(pi) {
          var v = (pi.metadata || {})[key] || 'unknown';
          map[v] = (map[v] || 0) + 1;
        });
        return map;
      }

      // 時間帯ごとの売上金額
      function amountBy(key) {
        var map = {};
        succeeded.forEach(function(pi) {
          var v = (pi.metadata || {})[key] || 'unknown';
          map[v] = (map[v] || 0) + pi.amount;
        });
        return map;
      }

      // 日別売上（過去30日）
      var now = Math.floor(Date.now() / 1000);
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
        nftMintedCount: succeeded.filter(function(pi) { return pi.metadata?.nftMinted === 'true'; }).length,
        bySeason:    countBy('season'),
        byWeather:   countBy('weather'),
        byTimeOfDay: countBy('timeOfDay'),
        byAmountTimeOfDay: amountBy('timeOfDay'),
        daily: dailyMap,
      });
    }

    return res.status(400).json({ error: '不明なaction: ' + action });

  } catch (err) {
    console.error('[admin]', err);
    return res.status(500).json({ error: err.message });
  }
}
