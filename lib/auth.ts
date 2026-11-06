import { redirect } from "next/navigation";
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

/**
 * For admin pages. Layout and page render in parallel under Suspense, so a
 * layout-only check does not stop the page from streaming its data: every
 * admin page must call this before reading the database.
 */
export async function requireAdminPage(): Promise<{ email: string }> {
  try {
    return await requireAdmin();
  } catch {
    redirect("/api/auth/signin?callbackUrl=/admin/review");
  }
}
