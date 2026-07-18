import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HF_TOKEN);

export async function POST(req) {
  try {
    const { audio } = await req.json();

    if (!audio) {
      return new Response(JSON.stringify({ error: 'Audio data is required' }), { status: 400 });
    }

    const base64Data = audio.split(',')[1];
    const binaryData = Buffer.from(base64Data, 'base64');
    const blob = new Blob([binaryData], { type: 'audio/webm' });

    const response = await hf.automaticSpeechRecognition({
      model: 'openai/whisper-large-v3-turbo',
      data: blob
    });

    return new Response(JSON.stringify({ text: response.text }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in transcribe API:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
