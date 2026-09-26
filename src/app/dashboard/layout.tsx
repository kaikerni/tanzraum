import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getZugriff } from "@/lib/dashboard/getBereiche";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { AnrufProvider } from "@/components/chat/AnrufProvider";
import { MobileNav } from "@/components/MobileNav";

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

  // Jugendschutz: ohne Geburtsdatum geht es erst nach der einmaligen Angabe weiter;
  // ebenso ohne Geschlecht (Pflichtangabe fuer die Bezeichnung in Profil und Mitgliederliste)
  const [{ data: geburtsdatum }, { data: geschlecht }] = await Promise.all([
    supabase.rpc("mein_geburtsdatum"),
    supabase.rpc("mein_geschlecht"),
  ]);
  if (!geburtsdatum) redirect("/geburtsdatum");
  if (!geschlecht) redirect("/geschlecht");

  const [{ data: ungelesen }, { count: benachrichtigungen }, zugriff] = await Promise.all([
    supabase.rpc("eigene_ungelesene_nachrichten_anzahl"),
    supabase
      .from("benachrichtigungen")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("gelesen", false),
    getZugriff(supabase, daten.istPlattformAdmin),
  ]);

  const name = [daten.vorname, daten.nachname].filter(Boolean).join(" ") || "TanzRaum-Nutzer";
  const ersterVerein = daten.vereine.find((v) => !v.vereinGesperrt) ?? daten.vereine[0];
  const rolle = daten.istPlattformAdmin ? "TanzRaum Admin" : (ersterVerein?.rolleName ?? "Mitglied");
  const kontext = daten.istPlattformAdmin
    ? { titel: "TanzRaum Admin", untertitel: "Administrator", istPlattformAdmin: true }
    : {
        titel: ersterVerein?.vereinName || name,
        untertitel: ersterVerein?.rolleName ?? "Mitglied",
        istPlattformAdmin: false,
      };
  const ungeleseneNachrichten = Number(ungelesen ?? 0);

  return (
    <AnrufProvider userId={user.id}>
    <div className="flex h-dvh flex-col bg-brand-bg">
      <AppHeader
        name={name}
        anzeigeName={daten.vorname || name}
        untertitel={rolle}
        ungeleseneNachrichten={ungeleseneNachrichten}
        ungeleseneBenachrichtigungen={benachrichtigungen ?? 0}
      />
      <div className="flex min-h-0 flex-1">
        <AppSidebar kontext={kontext} zugriff={zugriff} ungeleseneNachrichten={ungeleseneNachrichten} />
        <main className="flex-1 overflow-y-auto px-3 pb-28 pt-4 sm:px-5 md:pb-8 md:pt-5 xl:px-6">{children}</main>
      </div>
      <MobileNav zugriff={zugriff} ungeleseneNachrichten={ungeleseneNachrichten} />
    </div>
    </AnrufProvider>
  );
}
