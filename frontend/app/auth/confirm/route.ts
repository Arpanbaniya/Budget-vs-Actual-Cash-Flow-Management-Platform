import { type NextRequest, NextResponse } from "next/server";

import { isSupabaseConfigured } from "../../../lib/supabase/config";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const destination = new URL("/login?error=confirmation_failed", request.url);
  if (!isSupabaseConfigured()) return privateRedirect(destination);

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const supabase = await createClient();

  if (tokenHash && type === "email") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) return privateRedirect(new URL("/dashboard", request.url));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return privateRedirect(new URL("/dashboard", request.url));
  }

  return privateRedirect(destination);
}

function privateRedirect(destination: URL) {
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
