import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    // Currently fetches all chats, since we don't have Auth yet.
    // In Phase 4, we will filter by userId
    const chats = await prisma.chat.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      }
    });
    
    return new Response(JSON.stringify(chats), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST(req) {
  try {
    const chat = await prisma.chat.create({
      data: {
        title: "New Conversation"
      }
    });
    
    return new Response(JSON.stringify(chat), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error creating chat:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
