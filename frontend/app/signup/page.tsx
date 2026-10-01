import { redirect } from "next/navigation";

import { signup } from "../auth/actions";
import { AuthForm } from "../auth/auth-form";
import { isSupabaseConfigured } from "../../lib/supabase/config";
import { createClient } from "../../lib/supabase/server";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const configured = isSupabaseConfigured();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/dashboard");
  }
  const { error, message } = await searchParams;
  return <AuthForm mode="signup" action={signup} configured={configured} error={error} message={message} />;
}
