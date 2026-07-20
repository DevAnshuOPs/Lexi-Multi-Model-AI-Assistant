import { HfInference } from '@huggingface/inference';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Initialize Hugging Face Inference client
const hf = new HfInference(process.env.HF_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const formData = await req.formData();
    const messagesStr = formData.get('messages');
    const customSystemPrompt = formData.get('systemPrompt');
    let chatId = formData.get('chatId'); // Can be null if new chat
    
    if (!messagesStr) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), { status: 400 });
    }

    const messages = JSON.parse(messagesStr);
    const mediaFile = formData.get('media'); // Video/File object
    const audioFile = formData.get('audioFile'); // Raw mic audio object
    const latestMessage = messages[messages.length - 1];

    let caption = null;
    let finalReply = null;

    // Handle large files (Videos / Docs)
    if (mediaFile && (latestMessage.video || latestMessage.file)) {
      const bytes = await mediaFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const safeName = mediaFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const tempFilePath = path.join(os.tmpdir(), `${Date.now()}_${safeName}`);
      
      await writeFile(tempFilePath, buffer);
      
      try {
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
          mimeType: mediaFile.type,
          displayName: mediaFile.name,
        });

        let file = await fileManager.getFile(uploadResponse.file.name);
        while (file.state === "PROCESSING") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          file = await fileManager.getFile(uploadResponse.file.name);
        }

        if (file.state === "FAILED") {
          await unlink(tempFilePath).catch(console.error);
          return new Response(JSON.stringify({ error: 'Document/Video processing failed in Gemini' }), { status: 500 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Please analyze this attached file in detail. User asked: "${latestMessage.content}"`;
        
        const result = await model.generateContent([
          { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
          { text: prompt },
        ]);
        
        caption = result.response.text();
      } catch (uploadError) {
        await unlink(tempFilePath).catch(console.error);
        return new Response(JSON.stringify({ error: `File Analysis Error: ${uploadError.message}. Make sure you are using a supported file type (.txt, .pdf, .csv, .md).` }), { status: 400 });
      }
      
      await unlink(tempFilePath).catch(console.error);
    } 
    // Handle inline Native Audio
    else if (audioFile) {
      const bytes = await audioFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64Data = buffer.toString('base64');
      
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `Listen to this audio carefully. It may contain speech, music, or both. Describe the audio or answer the user's spoken request if present.`;
      
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: audioFile.type || 'audio/webm' } }
      ]);
      caption = result.response.text();
    }
    // Handle inline base64 images
    else if (latestMessage.image) {
      const base64Data = latestMessage.image.split(',')[1];
      const mimeType = latestMessage.image.match(/data:(.*?);/)[1] || 'image/jpeg';
      
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = "Please describe exactly what you see in this image in high detail.";
      const imageParts = [{ inlineData: { data: base64Data, mimeType } }];

      const result = await model.generateContent([prompt, ...imageParts]);
      caption = result.response.text();
    }

    // Prepare Custom System Prompt
    const conciseInstruction = " Keep your responses short, simple, concise, and conversational.";
    const finalSystemPrompt = customSystemPrompt && customSystemPrompt.trim().length > 0 
      ? `You are LEXI. ${customSystemPrompt}${conciseInstruction}` 
      : `You are LEXI, a multimodal AI assistant. You are here to help the user in any kind of task that is required. Always identify yourself as LEXI if asked.${conciseInstruction}`;

    const systemMessage = { role: 'system', content: finalSystemPrompt };
    
    if (caption) {
      finalReply = caption;
      if (latestMessage.content && latestMessage.content.trim() && latestMessage.content !== "Listen to this audio.") {
        // Truncate caption to prevent HuggingFace input token limit errors on large documents
        const truncatedCaption = caption.length > 4000 ? caption.substring(0, 4000) + '... (truncated)' : caption;
        const textPrompt = `The user uploaded an attachment or audio. The multimodal analysis is: "${truncatedCaption}".\n\nThe user also asked: "${latestMessage.content}"\n\nPlease answer the user's question based on the analysis.`;
        
        const textResponse = await hf.chatCompletion({
          model: 'Qwen/Qwen2.5-72B-Instruct',
          messages: [systemMessage, { role: 'user', content: textPrompt }],
        max_tokens: 2048,
          temperature: 0.7
        });
        finalReply = textResponse.choices[0].message.content.trim();
      }
    } else {
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
      formattedMessages.unshift(systemMessage);

      const textResponse = await hf.chatCompletion({
        model: 'Qwen/Qwen2.5-72B-Instruct',
        messages: formattedMessages,
        max_tokens: 2048,
        temperature: 0.7
      });
      finalReply = textResponse.choices[0].message.content.trim();
    }

    // DATABASE SAVING LOGIC
    // If no chatId, create a new chat!
    if (!chatId || chatId === 'null') {
      const newChat = await prisma.chat.create({
        data: {
          title: latestMessage.content ? latestMessage.content.substring(0, 30) + '...' : 'New Conversation',
          userId: session.user.id
        }
      });
      chatId = newChat.id;
    }

    // Verify chat belongs to user before adding messages
    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat || chat.userId !== session.user.id) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Save the user's message
    await prisma.message.create({
      data: {
        role: 'user',
        content: latestMessage.content || '',
        image: latestMessage.image || null,
        video: latestMessage.video || null,
        file: latestMessage.file || null,
        audio: latestMessage.audio || null,
        chatId: chatId,
      }
    });

    // Save LEXI's response
    await prisma.message.create({
      data: {
        role: 'assistant',
        content: finalReply,
        chatId: chatId,
      }
    });

    return new Response(JSON.stringify({ reply: finalReply, chatId }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
