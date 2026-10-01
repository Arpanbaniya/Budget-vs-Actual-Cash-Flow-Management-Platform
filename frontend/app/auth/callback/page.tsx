"use client";

import { useEffect } from "react";

import { createClient } from "../../../lib/supabase/client";

export default function AuthCallbackPage() {
  useEffect(() => {
    let active = true;

    async function completeConfirmation() {
      try {
        const query = new URLSearchParams(window.location.search);
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        if (query.has("error") || fragment.has("error")) {
          window.location.replace("/login?error=confirmation_failed");
          return;
        }
        // The browser client exchanges Supabase's default PKCE link and writes
        // the resulting session to the cookies used by the server client.
        const { data, error } = await createClient().auth.getSession();
        if (!active) return;
        window.location.replace(
          !error && data.session ? "/dashboard" : "/login?error=confirmation_failed",
        );
      } catch {
        if (active) window.location.replace("/login?error=confirmation_failed");
      }
    }

    void completeConfirmation();
    return () => { active = false; };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f4] px-6 text-[#142b25]">
      <p role="status" className="text-lg">Confirming your email…</p>
    </main>
  );
}
