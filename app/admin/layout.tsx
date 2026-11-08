import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth, isAdminEmail, signOut } from "../../lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 py-6">
      <Suspense fallback={<p className="text-muted">Loading review queue…</p>}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  await connection();
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/api/auth/signin?callbackUrl=/admin/review");
  if (!isAdminEmail(email, process.env.ADMIN_EMAILS ?? "")) {
    return (
      <main className="py-10">
        <h1 className="text-2xl font-semibold">Not allowed</h1>
        <p className="text-muted">{email} is not on the admin list.</p>
      </main>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-line pb-3 text-sm">
        <nav aria-label="Admin" className="flex items-center gap-4">
          <span className="font-medium">Admin</span>
          <Link href="/admin/review" className="min-h-11 content-center underline">
            Review
          </Link>
          <Link href="/admin/stale" className="min-h-11 content-center underline">
            Stale places
          </Link>
          <Link href="/admin/searches" className="min-h-11 content-center underline">
            Searches
          </Link>
          <Link href="/admin/dishes" className="min-h-11 content-center underline">
            Dishes
          </Link>
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="flex items-center gap-3"
        >
          <span className="text-muted">{email}</span>
          <button
            type="submit"
            className="min-h-11 rounded-[var(--radius-step)] border border-line px-3 focus-visible:outline-2 focus-visible:outline-accent"
          >
            Sign out
          </button>
        </form>
      </header>
      <main>{children}</main>
    </>
  );
}
