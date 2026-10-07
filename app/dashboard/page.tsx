import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: tasks }, { data: profile }] = await Promise.all([
    supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("full_name, timezone").eq("id", userId).maybeSingle(),
  ]);

  return <DashboardClient initialTasks={tasks ?? []} email={String(claimsData?.claims?.email ?? "")} profile={profile ?? null} />;
}
