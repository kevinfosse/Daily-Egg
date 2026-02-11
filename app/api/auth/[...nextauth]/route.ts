import NextAuth from "next-auth";
import { authOptions } from "../../../lib/auth/auth-options";

// NextAuth v5 returns an object with the handlers,
// not directly a route function.
const { handlers } = NextAuth(authOptions);

export const { GET, POST } = handlers;