"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "../../lib/supabase/server";
import { isSupabaseConfigured } from "../../lib/supabase/config";

function credentials(formData: FormData, minimumPasswordLength: number): { email: string; password: string } | null {
  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    password.length < minimumPasswordLength
  ) {
    return null;
  }
  return { email: email.trim(), password };
}

export async function login(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?error=not_configured");
  const data = credentials(formData, 1);
  if (!data) redirect("/login?error=invalid_input");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(data);
  if (error) redirect("/login?error=invalid_credentials");

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/signup?error=not_configured");
  const data = credentials(formData, 8);
  if (!data) redirect("/signup?error=invalid_input");

  const supabase = await createClient();
  const { data: result, error } = await supabase.auth.signUp(data);
  if (error) redirect("/signup?error=signup_failed");

  revalidatePath("/", "layout");
  if (!result.session) redirect("/signup?message=check_email");
  redirect("/dashboard");
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/login?message=signed_out");
}
