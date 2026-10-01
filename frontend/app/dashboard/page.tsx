import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "../auth/actions";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");

  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return (
    <main className="min-h-screen bg-[#f6f7f4] px-6 py-8 text-[#142b25]">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8dfd7] pb-6">
          <Link href="/" className="text-lg font-semibold">Flow &amp; Forecast</Link>
          <form action={logout}><button type="submit" className="rounded-xl border border-[#cbd7cd] bg-white px-4 py-2 text-sm font-medium hover:bg-[#eef4ec]">Sign out</button></form>
        </header>
        <section className="mt-16 rounded-[2rem] border border-[#d8e1d7] bg-white p-8 shadow-[0_24px_70px_rgba(27,60,42,0.09)] sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#407a5e]">Private workspace</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Your dashboard is ready.</h1>
          <p className="mt-5 max-w-2xl leading-7 text-[#53675d]">
            {email ? `Signed in as ${email}. ` : "You are signed in. "}
            Company setup and finance tools arrive in the next phases.
          </p>
          <p className="mt-8 rounded-xl bg-[#f3f7f1] p-4 text-sm text-[#53675d]">
            This page is available only to an authenticated account. No financial records are shown yet.
          </p>
        </section>
      </div>
    </main>
  );
}
