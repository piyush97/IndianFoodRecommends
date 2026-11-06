import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { isAdminEmail } from "./admin-email";

export { isAdminEmail };

export class AuthError extends Error {
  override name = "AuthError";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    signIn: ({ user }) => isAdminEmail(user.email, process.env.ADMIN_EMAILS ?? ""),
  },
});

export async function requireAdmin(): Promise<{ email: string }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!isAdminEmail(email, process.env.ADMIN_EMAILS ?? "")) {
    throw new AuthError("forbidden");
  }
  return { email: email! };
}
