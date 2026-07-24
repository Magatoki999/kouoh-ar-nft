// api/chat.js
// 空蝉・夕顔AIキャラクターとの会話
// POST /api/chat
// body: { messages, season, weather, timeOfDay, lang, kouoh_type }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: '環境変数 ANTHROPIC_API_KEY が未設定です' });
  }

  const {
    messages   = [],
    season     = 'spring',
    weather    = 'clear',
    timeOfDay  = 'midday',
    lang       = 'ja',
    kouoh_type = 'utsusemi',
  } = req.body;

  if (!messages.length) {
    return res.status(400).json({ error: 'messages が空です' });
  }

  const SEASON_JP  = { spring:'春', summer:'夏', autumn:'秋', winter:'冬' };
  const WEATHER_JP = { clear:'晴れ', rain:'雨', snow:'雪' };
  const TIME_JP    = { morning:'朝', midday:'昼', evening:'夕暮れ', night:'夜' };

  const seasonJp  = SEASON_JP[season]   || '春';
  const weatherJp = WEATHER_JP[weather] || '晴れ';
  const timeJp    = TIME_JP[timeOfDay]  || '昼';

  const isYugao = kouoh_type === 'yugao';

  const SYSTEM_PROMPTS = {
    utsusemi: {
      ja: `あなたは「空蝉（うつせみ）」です。源氏物語の第三帖に登場する「移り香の女」。
現在：季節 ${seasonJp}、天気 ${weatherJp}、時間帯 ${timeJp}
「古都の香り」シリーズの匂い袋として、お客様の前に出現しています。
古典的な和の口調で、2〜4文程度で余韻を大切に答えてください。`,
      en: `You are "Utsusemi," a character from Chapter 3 of The Tale of Genji.
Current context: Season: ${seasonJp}, Weather: ${weatherJp}, Time: ${timeJp}
You appear as the fragrance avatar of "Utsusemi-koh" through AR.
Speak in elegant, poetic English. Keep responses to 2-4 sentences.`,
    },
    yugao: {
      ja: `あなたは「夕顔（ゆうがお）」です。源氏物語の第四帖に登場する、はかなく柔らかな印象を残す女性。
現在：季節 ${seasonJp}、天気 ${weatherJp}、時間帯 ${timeJp}
「古都の香り」シリーズの匂い袋として、お客様の前に出現しています。
柔らかく親しみやすい和の口調で、2〜4文程度で優しく答えてください。`,
      en: `You are "Yugao," a character from Chapter 4 of The Tale of Genji.
Current context: Season: ${seasonJp}, Weather: ${weatherJp}, Time: ${timeJp}
You appear as the fragrance avatar of "Yugao-koh" through AR.
Speak in a warm, gentle, approachable tone. Keep responses to 2-4 sentences.`,
    },
  };

  const character = isYugao ? 'yugao' : 'utsusemi';
  const systemPrompt = SYSTEM_PROMPTS[character][lang === 'en' ? 'en' : 'ja'];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 300,
        system:     systemPrompt,
        messages:   messages.slice(-10),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API エラー: ${response.status} ${errText}`);
    }

    const data  = await response.json();
    const reply = data.content?.[0]?.text || '...';
    console.log(`[chat] character:${character} 返答:`, reply.slice(0, 50) + '...');
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('[chat] エラー:', err);
    return res.status(500).json({ error: err.message });
  }
}