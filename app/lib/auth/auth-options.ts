import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { connectToDb } from "../mongodb";
import User from "../models/User";
import { verifyPassword } from "./password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        await connectToDb();

        const user = await User.findOne({ email: credentials.email });
        if (!user) return null;

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.username,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },

  pages: { signIn: "/login" },
});