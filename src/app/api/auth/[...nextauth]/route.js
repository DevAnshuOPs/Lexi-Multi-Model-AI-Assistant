import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import prisma from "@/lib/prisma"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "pending_google_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "pending_google_secret",
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "pending_github_id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "pending_github_secret",
      allowDangerousEmailAccountLinking: true,
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token, user }) {
      if (session?.user) {
        // Handle both JWT strategy (token) and Database strategy (user)
        session.user.id = token?.sub || user?.id;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "LEXI_SUPER_SECRET_KEY_998877",
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
