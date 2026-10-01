import { cache } from "react";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "./supabase/config";
import { createClient } from "./supabase/server";

export const requireWorkspaceUser = cache(async () => {
  if (!isSupabaseConfigured()) redirect("/login");
  const { data, error } = await (await createClient()).auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") redirect("/login");
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});
