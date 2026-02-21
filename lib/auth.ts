import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  login: z.string().min(2),
  password: z.string().min(6)
});

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "salestraking-fallback-secret-change-me";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: authSecret,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (raw) => {
        try {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) return null;

          const login = parsed.data.login.trim().toLowerCase();
          const user = await prisma.user.findFirst({
            where: {
              OR: [{ email: login }, { username: login }]
            }
          });

          if (!user?.passwordHash) return null;
          const valid = await compare(parsed.data.password, user.passwordHash);
          if (!valid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image
          };
        } catch (error) {
          console.error("Credentials authorize failed:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: async ({ session, token, user }) => {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? user?.id ?? "");
      }
      return session;
    }
  }
});
