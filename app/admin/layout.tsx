import { requireAdmin } from "../../lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200 px-6 py-3 text-sm">
        <span className="font-medium">Indian Food Recommends · admin</span>
        <span className="ml-3 text-neutral-500">{email}</span>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
