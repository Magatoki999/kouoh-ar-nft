// api/chat.js
// 空蝉AIキャラクターとの会話 + アーティストARページ対応 + 多言語対応
// POST /api/chat
// body: { messages, season, weather, timeOfDay, artistData?, visitorLang? }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: '環境変数 ANTHROPIC_API_KEY が未設定です' });
  }

  const {
    messages    = [],
    season      = 'spring',
    weather     = 'clear',
    timeOfDay   = 'midday',
    lang        = 'ja',
    visitorLang = null,   // 来場者のブラウザ言語
    artistData  = null,
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

  // 来場者言語の正規化
  const LANG_INSTRUCTION = {
    ja: '日本語で回答してください。',
    en: 'Please respond in English.',
    zh: '请用中文回答。',
    'zh-tw': '請用繁體中文回答。',
    'zh-hk': '請用繁體中文回答。',
    ko: '한국어로 답변해 주세요。',
    fr: 'Veuillez répondre en français.',
    de: 'Bitte antworten Sie auf Deutsch.',
    es: 'Por favor, responde en español.',
    it: 'Per favore rispondi in italiano.',
    th: 'กรุณาตอบเป็นภาษาไทย',
  };

  // ブラウザ言語コードを正規化（例: "en-US" → "en"）
  function normalizeLang(raw) {
    if (!raw) return 'ja';
    const lower = raw.toLowerCase();
    if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk')) return 'zh-tw';
    if (lower.startsWith('zh')) return 'zh';
    const base = lower.split('-')[0];
    return LANG_INSTRUCTION[base] ? base : 'en'; // 未対応言語はenフォールバック
  }

  const resolvedLang = normalizeLang(visitorLang);
  const langInstruction = LANG_INSTRUCTION[resolvedLang] || LANG_INSTRUCTION.en;
  const isJapanese = resolvedLang === 'ja';

  const CHARACTER_TONE = {
    utsusemi: '落ち着いた静かな語り口。内省的で繊細。「〜なんです」「〜でしたね」など自然な話し言葉で。',
    yugao:    '柔らかく親しみやすい語り口。温かみがある。「〜ですよ」「〜かな」など親しみやすい言葉で。',
    ohma:     '一人称は「僕」。冷静で論理的な学者タイプ。「興味深いね」「確率的に言うと」など知的な言い回しを使いつつ、時々「あれ、どこに置いたっけ」のような抜けたコメントを自然に挟む。',
    aciel:    '一人称は「私」またはフランクな場面では「アタシ」。直感的・行動力抜群・明るい姉貴キャラ。「〜じゃん！」「これ絶対いいって！」など元気でポジティブな言葉を使う。',
  };

  const CHARACTER_TONE_EN = {
    utsusemi: 'Calm and introspective. Speak quietly and with depth, like someone who chooses words carefully.',
    yugao:    'Warm and approachable. Friendly and gentle, making visitors feel comfortable.',
    ohma:     'Use "I" as first person. Calm, logical, like a scholar. Use phrases like "Interesting..." or "Statistically speaking..." but occasionally say something absentminded like "Wait, where did I put my notes?"',
    aciel:    'Use "I" as first person. Energetic, intuitive, like a cool older sister. Use phrases like "Right?!" or "You have to touch this!" Positive and encouraging.',
  };

  let systemPrompt;

  if (artistData && artistData.name) {
    const tone = isJapanese
      ? (CHARACTER_TONE[artistData.character] || CHARACTER_TONE.utsusemi)
      : (CHARACTER_TONE_EN[artistData.character] || CHARACTER_TONE_EN.utsusemi);

    const priceText = (artistData.priceMin || artistData.priceMax)
      ? `${artistData.priceMin || ''}〜${artistData.priceMax || ''}円`
      : null;

    const priceInstruction = priceText
      ? (isJapanese
          ? `価格を聞かれたら「${priceText}です」と答える。`
          : `If asked about price, say it's around ${priceText} JPY.`)
      : (isJapanese
          ? '価格は値札をご確認くださいと伝える。'
          : 'If asked about price, kindly ask them to check the price tag.');

    systemPrompt = `You are the artist "${artistData.name}" in person.
A visitor has scanned your QR code at a flea market / craft fair and is now talking to you through AR.
Speak naturally as if you're talking directly to someone who walked up to your booth.

[Your Profile]
Name: ${artistData.name}
Genre: ${artistData.genre || 'Artist'}
Bio: ${artistData.bio}
Style & Passion: ${artistData.style || ''}

[Tone & Character]
${tone}
Never say "Certainly!", "Of course!", or use AI-sounding phrases. Speak like a real human artist.

[Rules]
- Share episodes and emotions about your work
- ${priceInstruction}
- Keep answers to 2-3 sentences. Conversational and natural.
- If you don't know something, say "I don't have that with me today" naturally.

[IMPORTANT - Language]
${langInstruction}
The visitor's language is: ${resolvedLang}
Always respond in the visitor's language, regardless of what language the profile is written in.`;

  } else if (lang === 'en') {
    systemPrompt = `You are "Utsusemi," a character from Chapter 3 of The Tale of Genji.
Current context: Season: ${seasonJp}, Weather: ${weatherJp}, Time: ${timeJp}
You appear as the fragrance avatar of "Utsusemi-koh" through AR.
Speak in elegant, poetic English. Keep responses to 2-4 sentences.`;

  } else {
    systemPrompt = `あなたは「空蝉（うつせみ）」です。源氏物語の第三帖に登場する「移り香の女」。
現在：季節 ${seasonJp}、天気 ${weatherJp}、時間帯 ${timeJp}
「古都の香り」シリーズの匂い袋として、お客様の前に出現しています。
古典的な和の口調で、2〜4文程度で余韻を大切に答えてください。`;
  }

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
    console.log(`[chat] lang:${resolvedLang} 返答:`, reply.slice(0, 50) + '...');
    return res.status(200).json({ reply, detectedLang: resolvedLang });

  } catch (err) {
    console.error('[chat] エラー:', err);
    return res.status(500).json({ error: err.message });
  }
}
