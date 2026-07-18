import * as googleTTS from 'google-tts-api';

export async function POST(req) {
  try {
    const { text, lang } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), { status: 400 });
    }

    const languageCode = lang ? lang.split('-')[0] : 'en';

    // googleTTS.getAllAudioBase64 returns an array of { shortText, base64 } objects
    const results = await googleTTS.getAllAudioBase64(text, {
      lang: languageCode,
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: ',.?',
    });

    return new Response(JSON.stringify({ audioChunks: results.map(r => r.base64) }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Error generating TTS:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
