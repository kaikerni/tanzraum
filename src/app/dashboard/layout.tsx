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
import { VereinswechselHinweis, type MeinVereinswechsel } from "@/components/verein/VereinswechselHinweis";
import { OnlineHerzschlag } from "@/components/online/OnlineHerzschlag";
import { NachrichtenZustellung } from "@/components/chat/NachrichtenZustellung";
import { aktiveAnsicht } from "@/lib/admin/ansichtLesen";
import { ANSICHT_LABEL, ansichtZugriff } from "@/lib/admin/ansicht";
import { AnsichtLeiste } from "@/components/admin/AnsichtUmschalter";
import { VorschauAufraeumen } from "@/components/admin/VorschauAufraeumen";
import { sichererLink } from "@/lib/updates/getUpdates";
import { UpdateHinweis } from "@/components/updates/UpdateHinweis";
import { sichtbareNav } from "@/lib/navigation";
import type { KaiKontext } from "@/lib/kai/typen";

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

  const [{ data: ungelesen }, { count: benachrichtigungen }, zugriff, wichtigeNews, ankuendigungen, meineAntraege, { count: neueAbmeldungen }, { data: wechselRoh }] = await Promise.all([
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
    // Badge am Menuepunkt Training: neue Abmeldungen (bestehende Benachrichtigungen, Typ training_abmeldung)
    supabase
      .from("benachrichtigungen")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("typ", "training_abmeldung")
      .eq("gelesen", false),
    // Vereinswechsel-Anfragen, denen die Person zustimmen kann (bzw. Stand nach ihrer Zustimmung)
    supabase.rpc("meine_vereinswechsel"),
  ]);
  // deno-lint-ignore no-explicit-any
  const vereinswechsel: MeinVereinswechsel[] = ((wechselRoh ?? []) as any[]).map((w) => ({
    id: w.id,
    zielVerein: w.ziel_verein,
    bestaetigt: w.bestaetigt === true,
    abgelehnt: w.bisheriger_verein_abgelehnt === true,
  }));
  const offeneAntraege = meineAntraege.filter((a) => a.status === "offen");
  // Wichtige News und wichtige TanzRaum-Ankuendigungen erscheinen als Popup, bis sie bestaetigt sind
  const popup: PopupEintrag[] = [
    // Updates & Neuigkeiten (Art „neuheit“) nie als Popup – sie erscheinen dezent auf dem Dashboard, unter „Was ist neu?“ und bei Kai
    ...ankuendigungen
      .filter((a) => a.wichtig && !a.gelesenAm && a.art !== "neuheit")
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

  // TanzRaum-Administration: „Ansicht als …“ ersetzt nur Menue und Dashboard (Beispieldaten), keine Rechte
  const ansicht = await aktiveAnsicht();
  const navZugriff = ansicht
    ? { ...ansichtZugriff(ansicht), musikAn: zugriff.musikAn, spotlightsAn: zugriff.spotlightsAn, juryraum: false, navTarife: zugriff.navTarife }
    : zugriff;
  // Offene Buddy-Anfragen (Buddys ab BASIC)
  let buddyAnfragen = 0;
  if (navZugriff.tarif !== "free" && !navZugriff.istPlattformAdmin) {
    const { data: anfragen } = await supabase.rpc("meine_kontaktanfragen");
    buddyAnfragen = ((anfragen ?? []) as { richtung: string }[]).filter((a) => a.richtung === "eingehend").length;
  }

  const name = [daten.vorname, daten.nachname].filter(Boolean).join(" ") || "TanzRaum-Nutzer";
  const ersterVerein = daten.vereine.find((v) => !v.vereinGesperrt) ?? daten.vereine[0];
  const rolle = daten.istPlattformAdmin ? "👑 TanzRaum-Admin" : (ersterVerein?.rolleName ?? "Mitglied");
  const kontext = ansicht
    ? { titel: ansicht.startsWith("verein") ? "TSC Beispielstadt" : "Beispielkonto", untertitel: ANSICHT_LABEL[ansicht], istPlattformAdmin: false }
    : daten.istPlattformAdmin
    ? { titel: "TanzRaum", untertitel: "👑 TanzRaum-Admin", istPlattformAdmin: true }
    : {
        titel: ersterVerein?.vereinName || name,
        untertitel: ersterVerein?.rolleName ?? "Mitglied",
        istPlattformAdmin: false,
      };
  const ungeleseneNachrichten = Number(ungelesen ?? 0);
  // Kai (Begleiter in der Kopfzeile): nur Anzeige-Angaben, die hier ohnehin vorliegen
  const kai: KaiKontext = {
    vorname: daten.vorname ?? "",
    istPlattformAdmin: navZugriff.istPlattformAdmin,
    hatVerein: navZugriff.tarif === "verein" && navZugriff.bereiche.some((b) => b.startsWith("rolle_")),
    istVereinsadmin: navZugriff.bereiche.includes("rolle_admin"),
    tarif: navZugriff.tarif,
    bereiche: sichtbareNav(navZugriff).map((n) => n.href),
    vorschau: !!ansicht,
    neuigkeiten: ansicht
      ? []
      : ankuendigungen
          .filter((a) => a.art === "neuheit" && a.kaiHinweis && !a.gelesenAm)
          .slice(0, 5)
          .map((a) => {
            const ziel = sichererLink(a.linkUrl);
            return {
              id: `update-${a.id}`,
              datum: a.sichtbarAb.slice(0, 10),
              titel: a.titel,
              text: a.kurztext || a.text.slice(0, 200),
              wichtig: true,
              aktion: ziel?.startsWith("/")
                ? { label: a.linkText || "Zeig es mir", href: ziel }
                : { label: "Mehr erfahren", href: "/dashboard/neu" },
            };
          }),
  };

  return (
    <AnrufProvider userId={user.id}>
    <div className="flex h-dvh flex-col bg-brand-bg">
      <AppHeader
        name={name}
        anzeigeName={daten.vorname || name}
        untertitel={rolle}
        ungeleseneNachrichten={ungeleseneNachrichten}
        nachrichtenHref={navZugriff.tarif === "free" && !navZugriff.istPlattformAdmin ? "/dashboard#neue-nachrichten" : "/dashboard/nachrichten"}
        ungeleseneBenachrichtigungen={benachrichtigungen ?? 0}
        kai={kai}
      />
      <div className="flex min-h-0 flex-1">
        <AppSidebar kontext={kontext} zugriff={navZugriff} ungeleseneNachrichten={ungeleseneNachrichten} neueAbmeldungen={neueAbmeldungen ?? 0} buddyAnfragen={buddyAnfragen} />
        <main className="flex flex-1 flex-col overflow-y-auto px-3 pb-28 pt-4 sm:px-5 md:pb-8 md:pt-5 xl:px-6">
          {ansicht && <AnsichtLeiste aktiv={ansicht} />}
          {offeneAntraege.length > 0 && <AntragHinweis antraege={offeneAntraege} />}
          {vereinswechsel.length > 0 && <VereinswechselHinweis wechsel={vereinswechsel} />}
          <div className="flex-1">{children}</div>
          <AppFusszeile className="mx-auto mt-10 w-full max-w-[1200px]" />
        </main>
      </div>
      <MobileNav zugriff={navZugriff} ungeleseneNachrichten={ungeleseneNachrichten} neueAbmeldungen={neueAbmeldungen ?? 0} buddyAnfragen={buddyAnfragen} />
      {popup.length > 0 && <WichtigPopup eintraege={popup} />}
      <UpdateHinweis />
      <OnlineHerzschlag />
      {!ansicht && <NachrichtenZustellung userId={user.id} />}
      {!ansicht && <VorschauAufraeumen />}
    </div>
    </AnrufProvider>
  );
}
