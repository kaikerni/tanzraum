import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getZugriff } from "@/lib/dashboard/getBereiche";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { AnrufProvider } from "@/components/chat/AnrufProvider";
import { MobileNav } from "@/components/MobileNav";
import { AppFusszeile } from "@/components/recht/AppFusszeile";
import { WichtigPopup, type PopupEintrag } from "@/components/news/WichtigPopup";
import { getAnkuendigungen, getOffeneWichtigeNews } from "@/lib/news/getNews";
import { getMeineAntraege } from "@/lib/antraege/getAntraege";
import { AntragHinweis } from "@/components/antraege/AntragHinweis";

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
  // Kinderkonto unter 16 ohne dokumentierte Zustimmung eines Elternteils (das Login ist zusaetzlich gesperrt)
  const { data: kinderkonto } = await supabase.rpc("mein_kinderkonto_status");
  if (kinderkonto === "zustimmung_noetig" || kinderkonto === "wartet") redirect("/kinderkonto");
  if (!geschlecht) redirect("/geschlecht");
  // Aktuelle Nutzungsbedingungen noch nicht bestaetigt (Bestandskonto oder neue Fassung) -> einmalig nachholen
  const { data: rechtstexteOffen } = await supabase.rpc("rechtstexte_offen");
  if (rechtstexteOffen === true) redirect("/rechtstexte");

  const [{ data: ungelesen }, { count: benachrichtigungen }, zugriff, wichtigeNews, ankuendigungen, meineAntraege] = await Promise.all([
    supabase.rpc("eigene_ungelesene_nachrichten_anzahl"),
    supabase
      .from("benachrichtigungen")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("gelesen", false),
    getZugriff(supabase, daten.istPlattformAdmin),
    getOffeneWichtigeNews(supabase),
    getAnkuendigungen(supabase),
    getMeineAntraege(supabase),
  ]);
  const offeneAntraege = meineAntraege.filter((a) => a.status === "offen");
  // Wichtige News und wichtige TanzRaum-Ankuendigungen erscheinen als Popup, bis sie bestaetigt sind
  const popup: PopupEintrag[] = [
    ...ankuendigungen
      .filter((a) => a.wichtig && !a.gelesenAm)
      .map((a) => ({
        art: "ankuendigung" as const,
        id: a.id,
        titel: a.titel,
        text: a.text,
        quelle: "TanzRaum",
        zeit: a.sichtbarAb,
        bildUrl: a.bildUrl,
        linkUrl: a.linkUrl,
        linkText: a.linkText,
      })),
    ...wichtigeNews.map((n) => ({ art: "news" as const, id: n.id, titel: n.titel, text: n.text, quelle: n.autor ? `${n.vereinName} · ${n.autor}` : n.vereinName, zeit: n.erstelltAm })),
  ];

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
        <main className="flex flex-1 flex-col overflow-y-auto px-3 pb-28 pt-4 sm:px-5 md:pb-8 md:pt-5 xl:px-6">
          {offeneAntraege.length > 0 && <AntragHinweis antraege={offeneAntraege} />}
          <div className="flex-1">{children}</div>
          <AppFusszeile className="mx-auto mt-10 w-full max-w-[1200px]" />
        </main>
      </div>
      <MobileNav zugriff={zugriff} ungeleseneNachrichten={ungeleseneNachrichten} />
      {popup.length > 0 && <WichtigPopup eintraege={popup} />}
    </div>
    </AnrufProvider>
  );
}
