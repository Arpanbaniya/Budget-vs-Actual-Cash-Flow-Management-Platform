import Link from "next/link";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (formData: FormData) => Promise<void>;
  configured: boolean;
  error?: string;
  message?: string;
};

const errorText: Record<string, string> = {
  invalid_input: "Enter a valid email and password.",
  invalid_credentials: "We could not sign you in. Check your email and password.",
  signup_failed: "We could not create your account. Please try again.",
  confirmation_failed: "That confirmation link is invalid or has expired.",
  not_configured: "Account access is waiting for the Supabase project setup.",
};

export function AuthForm({ mode, action, configured, error, message }: AuthFormProps) {
  const signingUp = mode === "signup";
  const title = signingUp ? "Create your account" : "Welcome back";
  const status = error ? errorText[error] : message === "check_email"
    ? "Check your email for a confirmation link, then sign in."
    : message === "signed_out" ? "You have signed out." : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f4] px-6 py-10 text-[#142b25]">
      <section className="w-full max-w-lg rounded-[2rem] border border-[#d8e1d7] bg-white p-8 shadow-[0_24px_70px_rgba(27,60,42,0.09)] sm:p-12">
        <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-[#407a5e]">Flow &amp; Forecast</Link>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 leading-7 text-[#53675d]">
          {signingUp ? "Set up a private workspace for your finance planning." : "Sign in to your private finance workspace."}
        </p>
        {!configured && (
          <p role="status" className="mt-6 rounded-xl border border-[#e6d1a4] bg-[#fff8e9] p-4 text-sm leading-6 text-[#6c5322]">
            Account access is waiting for the Supabase project URL and publishable key to be configured.
          </p>
        )}
        {status && (
          <p role={error ? "alert" : "status"} className="mt-6 rounded-xl border border-[#d8e1d7] bg-[#f3f7f1] p-4 text-sm leading-6 text-[#244a38]">
            {status}
          </p>
        )}
        <form action={action} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required disabled={!configured} className="w-full rounded-xl border border-[#cbd7cd] bg-white px-4 py-3 outline-none focus:border-[#164d3b] focus:ring-2 focus:ring-[#b9d8c0] disabled:bg-[#f1f3ef]" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
            <input id="password" name="password" type="password" autoComplete={signingUp ? "new-password" : "current-password"} minLength={signingUp ? 8 : 1} required disabled={!configured} className="w-full rounded-xl border border-[#cbd7cd] bg-white px-4 py-3 outline-none focus:border-[#164d3b] focus:ring-2 focus:ring-[#b9d8c0] disabled:bg-[#f1f3ef]" />
          </div>
          <button type="submit" disabled={!configured} className="w-full rounded-xl bg-[#164d3b] px-5 py-3 font-medium text-white transition hover:bg-[#0c3829] disabled:cursor-not-allowed disabled:bg-[#9aaba0]">
            {signingUp ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="mt-7 text-sm text-[#53675d]">
          {signingUp ? "Already have an account?" : "New here?"}{" "}
          <Link href={signingUp ? "/login" : "/signup"} className="font-semibold text-[#164d3b] underline underline-offset-4">
            {signingUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
