import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const passwordIsValid = await bcrypt.compare(
          password,
          user.passwordHash,
        );

        if (passwordIsValid) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }

      if (trigger === "update" && session?.user) {
        token.name = session.user.name;
        token.email = session.user.email;
        token.picture = session.user.image;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.name = typeof token.name === "string" ? token.name : null;
        session.user.email = typeof token.email === "string" ? token.email : "";
        session.user.image =
          typeof token.picture === "string" ? token.picture : null;
      }

      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const isDashboardRoute =
        request.nextUrl.pathname === "/dashboard" ||
        request.nextUrl.pathname.startsWith("/dashboard/");

      if (isDashboardRoute) {
        return isLoggedIn;
      }

      return true;
    },
  },
});
