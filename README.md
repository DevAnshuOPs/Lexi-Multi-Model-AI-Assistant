# 🧠 LEXI - Multimodal AI Assistant

LEXI is a highly advanced, fully multimodal web-based Artificial Intelligence assistant. Built with Next.js, LEXI leverages cutting-edge LLMs (Large Language Models) to seamlessly process text, images, video, and raw audio in real time. 

This document serves as a comprehensive architectural overview, specifically tailored to explain the Artificial Intelligence and Machine Learning (AI/ML) workflows driving the application.

---

## 🔬 Core AI/ML Architecture

The true power of LEXI lies in its backend API integrations, specifically tailored to handle multimodal interactions beyond standard text-chat.

### 1. The Engine: Google Gemini 2.5 Flash
LEXI is powered by the **Google Gemini 2.5 Flash** model via the `@google/generative-ai` SDK. This model was chosen for its native multimodal capabilities and blazing-fast inference speeds, which are critical for maintaining low-latency, conversational AI interactions.

Unlike traditional architectures where audio or images are processed by separate, disjointed ML pipelines (e.g., using a separate STT model like Whisper to extract text, then feeding that text to an LLM), Gemini processes multimodal inputs *natively*.

### 2. Handling Multimodal Inputs

LEXI processes four primary data types. Here is exactly how the ML pipeline handles each:

#### 📝 Text & System Prompts
Standard text inputs are packaged into a JSON array maintaining the conversation history. We inject **Custom System Prompts** (saved in the user's database settings) directly into the API request, utilizing Gemini's context window to dynamically alter the AI's persona, language, and behavior on the fly.

#### 🖼️ Images (Inline Base64)
When a user uploads an image, the frontend reads it as a Base64 string. 
- **The Flow:** The Base64 string is passed to the Next.js `/api/chat` route. The server decodes it and structures it into Gemini's `inlineData` format.
- **The ML Aspect:** Gemini uses its computer vision capabilities to analyze the raw pixels alongside the user's text prompt, generating highly contextual responses (e.g., "Describe this image").

#### 🎤 Voice & Audio (Native STT)
LEXI features a "Conversation Mode" that records raw audio from the user's microphone using the browser's `MediaRecorder` API.
- **The Flow:** The audio blob is sent to `/api/chat`. Instead of using an external Speech-to-Text engine, the raw `audio/webm` buffer is converted to Base64 and fed directly to Gemini via `inlineData`. 
- **The ML Aspect:** The model natively interprets the acoustic features of the audio, allowing it to understand nuances like tone and emotion, directly generating a text response to the spoken query.

#### 🎥 Videos & Large Documents (File Manager API)
Large media cannot be sent via Base64 inline data due to payload limits.
- **The Flow:** The server writes the incoming video/PDF to a temporary OS directory. It then uses the `GoogleAIFileManager` SDK to upload the file to Google's cloud. 
- **The ML Aspect:** The server polls the API until the file's processing state transitions from `PROCESSING` to `ACTIVE`. Once active, the file's unique `fileUri` is passed to the Gemini model, allowing the ML model to perform temporal analysis on video frames or parse complex documents.

### 3. Speech Synthesis (Cloud TTS)
To give LEXI a voice, the application utilizes `google-tts-api` located in `/api/tts`.
- **The ML Aspect:** Instead of relying on the local device's fragmented OS voice packs (`window.speechSynthesis`), the server translates LEXI's text response into spoken audio using Google's Cloud Text-to-Speech ML engine.
- **The Flow:** The text is chunked, sent to Google Translate's TTS endpoints, and returned as a Base64 MP3 stream. The frontend queues these chunks in a `useRef` array and plays them sequentially using the HTML5 `Audio` API, achieving seamless streaming audio playback across *any* device or browser.

---

## 🏗️ Backend & Infrastructure

To support the AI operations, a robust full-stack infrastructure was implemented:

- **Next.js App Router:** Serverless API routes securely handle all API keys (Gemini, HuggingFace) so they are never exposed to the client.
- **Authentication:** `NextAuth.js` provides stateless session management via Google and GitHub OAuth providers.
- **Database (Vercel Postgres & Prisma ORM):** 
  - **Chat History:** Stores all past conversations, allowing the LLM to maintain historical context across sessions.
  - **Persistent Profile:** The database stores user-specific parameters like UI Theme, Preferred Spoken Language (with 20+ dialects supported), and Custom Instructions, persisting them seamlessly across devices.

---

## 🎨 UI/UX & Dynamic Surfaces

LEXI's frontend is designed to feel "alive". 

- **Ambient Slime Surface:** A global `mousemove` event listener tracks the user's cursor (`e.clientX / e.clientY`) and updates CSS Custom Properties (`--mouse-x`, `--mouse-y`) on the `document.body`. 
- **The CSS Magic:** The `globals.css` utilizes these coordinates to drive a complex, multi-layered `radial-gradient` background. Combined with specific opacity overlays, it creates the illusion of a vibrant, purplish, slimy liquid surface that organically reacts and bends to the user's physical mouse movements globally across the entire application.

---

## 🔄 The Full Execution Cycle (Summary)
If asked to trace a single request during a Viva, describe this flow:
1. User clicks the Mic and speaks. Audio is recorded and sent to `/api/chat`.
2. The Next.js server authenticates the user via NextAuth and retrieves their custom prompt instructions from Postgres.
3. The server pipes the raw audio directly into **Gemini 2.5 Flash**.
4. Gemini natively transcribes the audio, analyzes the context, and generates a text response.
5. The server saves this interaction to the PostgreSQL database via Prisma.
6. The text response is immediately routed to `/api/tts`.
7. Google's Cloud ML generates MP3 speech buffers and streams them to the client.
8. The React frontend plays the audio queue while the dynamic UI reacts to the user's mouse.

---

## 💻 4. Code Snippets & References

### 4.1 Chat API (`/api/chat`)
This route handles multimodal file processing, truncates context limits, and integrates the Gemini SDK.
```javascript
// Excerpt from src/app/api/chat/route.js
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const prompt = `Please analyze this attached file in detail. User asked: "${latestMessage.content}"`;

// Multimodal File Analysis
const result = await model.generateContent([
  { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
  { text: prompt },
]);
caption = result.response.text();
```

### 4.2 AI Processing Pipeline (Whisper ASR Integration)
This pipeline converts raw microphone `audio/webm` blobs into text transcripts using HuggingFace serverless inference.
```javascript
// Excerpt from src/app/api/transcribe/route.js
const response = await hf.automaticSpeechRecognition({
  model: 'openai/whisper-large-v3-turbo',
  data: blob
});
return new Response(JSON.stringify({ text: response.text }), { status: 200 });
```

### 4.3 Database Schema (Prisma)
Defines the relational mappings for Users, OAuth Sessions, and Chat Message Histories in PostgreSQL.
```prisma
// Excerpt from prisma/schema.prisma
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  theme         String?   @default("dark")
  instructions  String?   @db.Text
  chats         Chat[]
}

model Message {
  id        String   @id @default(cuid())
  role      String   // 'user' or 'assistant'
  content   String   @db.Text
  chatId    String
  chat      Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

### 4.4 User Interface
*(Insert screenshots of your deployed application here. Recommended: Desktop Dark Mode, Desktop Light Mode, and Mobile layout)*
