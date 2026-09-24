import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  if (daten.gesperrt) redirect("/gesperrt");

  const { data: onboarding } = await supabase
    .from("onboarding_progress")
    .select("completed")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!onboarding || !onboarding.completed) redirect("/onboarding");

  const { data: ungelesen } = await supabase.rpc("eigene_ungelesene_nachrichten_anzahl");

  const name = [daten.vorname, daten.nachname].filter(Boolean).join(" ") || "TanzRaum-Nutzer";
  const rolle = daten.istPlattformAdmin ? "Administrator" : "Mitglied";

  return (
    <div className="flex h-screen flex-col bg-brand-bg">
      <AppHeader name={name} rolle={rolle} ungeleseneNachrichten={Number(ungelesen ?? 0)} />
      <div className="flex min-h-0 flex-1">
        <AppSidebar name={name} rolle={rolle} />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
