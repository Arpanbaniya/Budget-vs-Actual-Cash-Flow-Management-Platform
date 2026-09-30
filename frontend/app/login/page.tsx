import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f4] px-6 text-[#142b25]">
      <section className="w-full max-w-lg rounded-[2rem] border border-[#d8e1d7] bg-white p-8 shadow-[0_24px_70px_rgba(27,60,42,0.09)] sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#407a5e]">Flow &amp; Forecast</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight">Dashboard access is coming soon.</h1>
        <p className="mt-5 leading-7 text-[#53675d]">
          Sign-in and private workspaces are planned for Phase 3. The dashboard stays closed until authentication is ready.
        </p>
        <Link href="/" className="mt-8 inline-flex rounded-xl bg-[#164d3b] px-5 py-3 font-medium text-white hover:bg-[#0c3829]">
          Back to the overview
        </Link>
      </section>
    </main>
  );
}
