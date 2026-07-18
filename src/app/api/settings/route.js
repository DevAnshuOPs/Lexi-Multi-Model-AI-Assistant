import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { theme: true, language: true, instructions: true }
    });

    return new Response(JSON.stringify(user || {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { theme, language, instructions } = await req.json();

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        theme,
        language,
        instructions
      }
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error updating settings:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
