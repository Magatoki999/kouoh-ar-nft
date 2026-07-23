// api/like.js - ESModule版
// キャラクター別いいねカウント
// GET  /api/like?char=utsusemi  → 空蝉のいいね数
// GET  /api/like?char=yugao     → 夕顔のいいね数
// POST /api/like?char=utsusemi  → 空蝉のいいね+1
// POST /api/like?char=yugao     → 夕顔のいいね+1
// charパラメータ省略時は 'utsusemi'（後方互換）
import https from 'https';

const VALID_CHARS = ['utsusemi', 'yugao'];

function getKey(char) {
  const c = VALID_CHARS.includes(char) ? char : 'utsusemi';
  return 'kouoh:likes:' + c;
}

function redis(...args) {
  return new Promise((resolve, reject) => {
    const url   = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) return reject(new Error('env vars missing'));
    const body   = JSON.stringify(args);
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path:     parsed.pathname,
      method:   'POST',
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error));
          resolve(json.result);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const char = req.query?.char || 'utsusemi';
  const key  = getKey(char);

  // GET：いいね数を返す
  if (req.method === 'GET') {
    try {
      const total = await redis('GET', key);
      return res.status(200).json({ total: Number(total) || 0, char });
    } catch(e) {
      console.error('[like] GET:', e.message);
      return res.status(500).json({ error: e.message, total: 0 });
    }
  }

  // POST：+1
  if (req.method === 'POST') {
    try {
      const newTotal = await redis('INCR', key);
      return res.status(200).json({ total: Number(newTotal) || 0, char });
    } catch(e) {
      console.error('[like] POST:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
