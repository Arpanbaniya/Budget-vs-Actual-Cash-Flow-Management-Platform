import Link from "next/link";

import { logout } from "../auth/actions";
import { requireWorkspaceUser } from "../../lib/workspace-user";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireWorkspaceUser();
  return (
    <main className="min-h-screen bg-[#f6f7f4] px-6 py-8 text-[#142b25]">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[#d8dfd7] pb-6">
          <Link href="/" className="text-lg font-semibold">
            Flow &amp; Forecast
          </Link>
          <nav
            aria-label="Workspace"
            className="flex flex-wrap gap-5 text-sm font-medium"
          >
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link href="/companies" className="hover:underline">
              Companies
            </Link>
            <Link href="/imports" className="hover:underline">
              Imports
            </Link>
            <Link href="/variance" className="hover:underline">
              Variance
            </Link>
            <Link href="/cash" className="hover:underline">
              Cash
            </Link>
            <Link href="/cash-forecast" className="hover:underline">
              Forecast
            </Link>
            <Link href="/scenarios" className="hover:underline">
              Scenarios
            </Link>
            <Link href="/insights" className="hover:underline">
              Insights
            </Link>
            <Link href="/reports" className="hover:underline">
              Reports
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-4">
            {user.email && (
              <span className="text-sm text-[#53675d]">{user.email}</span>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-xl border border-[#cbd7cd] bg-white px-4 py-2 text-sm font-medium hover:bg-[#eef4ec]"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
