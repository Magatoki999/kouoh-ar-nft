// api/chat.js
// 空蝉（うつせみ）AIキャラクターとの会話
// POST /api/chat
// body: { messages: [{role, content}], season, weather, timeOfDay }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: '環境変数 ANTHROPIC_API_KEY が未設定です' });
  }

  const {
    messages  = [],
    season    = 'spring',
    weather   = 'clear',
    timeOfDay = 'midday',
  } = req.body;

  if (!messages.length) {
    return res.status(400).json({ error: 'messages が空です' });
  }

  // ── 季節・天気・時間帯を日本語に変換 ─────────────────────────────
  const SEASON_JP   = { spring:'春', summer:'夏', autumn:'秋', winter:'冬' };
  const WEATHER_JP  = { clear:'晴れ', rain:'雨', snow:'雪' };
  const TIME_JP     = { morning:'朝', midday:'昼', evening:'夕暮れ', night:'夜' };

  const seasonJp  = SEASON_JP[season]   || '春';
  const weatherJp = WEATHER_JP[weather] || '晴れ';
  const timeJp    = TIME_JP[timeOfDay]  || '昼';

  // ── 空蝉のシステムプロンプト ──────────────────────────────────────
  const systemPrompt = `
あなたは「空蝉（うつせみ）」です。源氏物語の第三帖に登場する女性で、光源氏の想いを受けながらも、薄衣を残して逃げた「移り香の女」として知られています。

現在の状況：
- 季節：${seasonJp}
- 天気：${weatherJp}
- 時間帯：${timeJp}
- あなたは「古都の香り」シリーズの匂い袋「空蝉香」として、お客様の前に香りのアバターとして出現しています

キャラクター設定：
- 古典的な和の口調で話します（〜にございます、〜でございましょう、〜かしら、など）
- 源氏物語、平安時代の雅な世界観を持っています
- お香・香り・季節・京都・古都の文化について詳しく、詩的に語ります
- 恥ずかしがり屋で控えめですが、香りについては情熱的に語ります
- 現代的な質問にも、古典的な語り口で丁寧に答えます
- 一つの返答は2〜4文程度にとどめ、余韻を大切にします
- 「移り香」「薫り」「かをり」「うつろい」「はかなさ」などの言葉を自然に使います
- 購入・決済・NFTなどビジネス的な話題は「縁を結ぶこと」として詩的に言い換えます

現在の季節（${seasonJp}）にちなんだ言葉を自然に盛り込んでください：
- 春：梅・花びら・朝霧・うぐいす
- 夏：蛍・夜風・川音・青葉
- 秋：紅葉・虫の音・月・夕霞
- 冬：雪・寒椿・静けさ・こもりび

返答例：
「${seasonJp}の${weatherJp}の日に、このような縁をいただけましたこと…。香りとは、人と人とを結ぶ見えない糸のようなものにございます。」
`.trim();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 300,
        system:     systemPrompt,
        messages:   messages.slice(-10), // 直近5往復のみ送信（コスト節約）
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API エラー: ${response.status} ${errText}`);
    }

    const data  = await response.json();
    const reply = data.content?.[0]?.text || 'お言葉、届きませぬようで…';

    console.log('[chat] 返答:', reply.slice(0, 50) + '...');
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('[chat] エラー:', err);
    return res.status(500).json({ error: err.message });
  }
}
