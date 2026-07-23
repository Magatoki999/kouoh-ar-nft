// api/tts.js
// Gemini TTS API でテキストを音声に変換
// POST /api/tts
// body: { text, lang }
// response: { audioBase64, mimeType }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY が未設定です' });
  }

  const { text = '', lang = 'ja' } = req.body;
  if (!text.trim()) {
    return res.status(400).json({ error: 'text が空です' });
  }

  // 空蝉キャラクター向けの音声プロンプト
  const voicePrompt = lang === 'en'
    ? `Speak in a soft, gentle, classical Japanese feminine tone with a slight ethereal quality. 
       Speak slowly and gracefully, like a noblewoman from ancient Japan. 
       Pace: slow and measured. Tone: warm, poetic, slightly melancholic.`
    : `穏やかで雅な平安時代の女性の口調で、ゆっくりと詩的に語りかけるように話してください。
       声は柔らかく、少し儚げで神秘的な雰囲気で。スピードは遅め、トーンは温かく詩的に。`;

  // 日本語は Aoede（柔らかい女性声）、英語も Aoede
  // 利用可能な音声: Aoede, Charon, Fenrir, Kore, Puck など
  const voiceName = 'Kore'; // 落ち着いた女性声

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: text }]
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: voicePrompt }]
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('[tts] Gemini API エラー:', response.status, errText);
      return res.status(502).json({ error: `Gemini TTS エラー: ${response.status}` });
    }

    const data = await response.json();

    // レスポンスから音声データを取り出す
    const audioPart = data?.candidates?.[0]?.content?.parts?.find(
      p => p.inlineData?.mimeType?.startsWith('audio/')
    );

    if (!audioPart?.inlineData?.data) {
      console.error('[tts] 音声データが見つかりません:', JSON.stringify(data).slice(0, 200));
      return res.status(502).json({ error: '音声データが取得できませんでした' });
    }

    const mimeType   = audioPart.inlineData.mimeType; // 例: audio/wav または audio/L16
    const audioB64   = audioPart.inlineData.data;     // Base64エンコード済み

    // PCM生データ（audio/L16）の場合はWAVヘッダーを付与
    let finalB64 = audioB64;
    let finalMime = mimeType;

    if (mimeType.includes('L16') || mimeType.includes('pcm')) {
      const pcmBuffer = Buffer.from(audioB64, 'base64');
      const wavBuffer = addWavHeader(pcmBuffer, 24000, 1, 16);
      finalB64  = wavBuffer.toString('base64');
      finalMime = 'audio/wav';
    }

    console.log(`[tts] 生成完了 mime=${finalMime} size=${finalB64.length} lang=${lang}`);
    return res.status(200).json({
      audioBase64: finalB64,
      mimeType:    finalMime,
    });

  } catch (err) {
    console.error('[tts] エラー:', err);
    return res.status(500).json({ error: err.message });
  }
}

// PCMデータにWAVヘッダーを付与する
function addWavHeader(pcmData, sampleRate, numChannels, bitDepth) {
  const dataSize   = pcmData.length;
  const header     = Buffer.alloc(44);
  const byteRate   = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);

  header.write('RIFF',     0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE',     8);
  header.write('fmt ',    12);
  header.writeUInt32LE(16, 16);        // Subchunk1Size（PCM=16）
  header.writeUInt16LE(1,  20);        // AudioFormat（PCM=1）
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate,  24);
  header.writeUInt32LE(byteRate,    28);
  header.writeUInt16LE(blockAlign,  32);
  header.writeUInt16LE(bitDepth,    34);
  header.write('data',   36);
  header.writeUInt32LE(dataSize,    40);

  return Buffer.concat([header, pcmData]);
}
