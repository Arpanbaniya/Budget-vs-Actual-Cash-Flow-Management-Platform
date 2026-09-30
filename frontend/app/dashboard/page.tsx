import { redirect } from "next/navigation";

// Phase 3 will replace this gate with Supabase session verification.
export default function DashboardPage() {
  redirect("/login");
}
