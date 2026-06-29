import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [Google({ allowDangerousEmailAccountLinking: true })],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && profile && user.email) {
        const name = typeof profile.name === "string" ? profile.name : null;
        const image = typeof profile.picture === "string" ? profile.picture : null;

        await dbConnect();
        await User.updateOne({ email: user.email }, { $set: { name, image } });

        user.name = name;
        user.image = image;
      }
      return true;
    },
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
