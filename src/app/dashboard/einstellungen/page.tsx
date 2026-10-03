import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, KeyRound, EyeOff, Users, Map as MapIcon, UserRound, Bell, ShieldCheck, Building2, Radio, ListOrdered, CreditCard } from "lucide-react";
import { LIZENZART_LABEL, lizenzStatus } from "@/lib/lizenz";
import { datum as tarifDatum, type MeinTarifStatus } from "@/lib/tarife";
import { MeineNavigation, type NaviPunkt } from "@/components/einstellungen/MeineNavigation";
import { getZugriff } from "@/lib/dashboard/getBereiche";
import { aktiveAnsicht } from "@/lib/admin/ansichtLesen";
import { ansichtZugriff } from "@/lib/admin/ansicht";
import { erlaubteNav, navGruppen, SYSTEM_NAV } from "@/lib/navigation";
import { PushSchalter } from "@/components/chat/PushSchalter";
import { PushKategorien } from "@/components/einstellungen/PushKategorien";
import { EinwilligungsVerlauf, type Einwilligung } from "@/components/einstellungen/EinwilligungsVerlauf";
import { KontoLoeschen } from "@/components/einstellungen/KontoLoeschen";
import { MapEinstellungen } from "@/components/einstellungen/MapEinstellungen";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EmailAendern, OnlineSchalter, PasswortAendern, PrivatSchalter, VereinAngabe } from "@/components/einstellungen/KontoSicherheit";
import { GeschlechtAuswahl } from "@/components/einstellungen/GeschlechtAuswahl";
import { ElternCode, KindVerknuepfen, MeineKinder } from "@/components/familie/Familie";
import { alterAm, getMeineEltern, getMeineKinder, getMeineSchutzEinstellungen } from "@/lib/familie/getFamilie";
import { heuteBerlin } from "@/lib/training/getTraining";
import { KINDERKONTO_BIS, VOLLJAEHRIG_AB } from "@/lib/auth/alter";
import { TanzRaumAssistant } from "@/components/kai/TanzRaumAssistant";
import { KaiStarten } from "@/components/kai/KaiStarten";

export const metadata = { title: "Einstellungen – TanzRaum" };

const HINWEISE: Record<string, string> = {
  geaendert: "Deine E-Mail-Adresse wurde geändert. Ab sofort meldest du dich mit der neuen Adresse an.",
};

export default async function EinstellungenSeite({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/einstellungen");

  const { email } = await searchParams;
  const [{ data: profil }, { data: geburtsdatum }, { data: geschlecht }, { data: angabenRoh }] = await Promise.all([
    supabase.from("profiles").select("konto_privat").eq("id", user.id).maybeSingle(),
    supabase.rpc("mein_geburtsdatum"),
    supabase.rpc("mein_geschlecht"),
    supabase.rpc("meine_profilangaben"),
  ]);
  const angaben = (angabenRoh ?? {}) as { verein_angabe?: string | null; online_sichtbar?: boolean };
  const [{ data: mapDaten }, { data: pushDaten }, { data: einwilligungen }, { data: loeschung }] = await Promise.all([
    supabase.rpc("meine_map_einstellungen"),
    supabase.rpc("meine_push_einstellungen"),
    supabase.from("einwilligungen").select("id, art, version, erteilt, quelle, zeitpunkt").eq("user_id", user.id).order("zeitpunkt", { ascending: false }).limit(50),
    supabase.rpc("mein_konto_loeschung_status"),
  ]);
  // deno-lint-ignore no-explicit-any
  const hindernisse = ((((loeschung ?? []) as any[])[0]?.hindernisse ?? []) as { grund: string; text: string }[]);
  const pushStand = Object.fromEntries(((pushDaten ?? []) as { kategorie: string; aktiv: boolean }[]).map((p) => [p.kategorie, p.aktiv]));
  // deno-lint-ignore no-explicit-any
  const m = ((mapDaten ?? []) as any[])[0];
  const mapStand = {
    mapSichtbar: !!m?.map_sichtbar,
    ort: m?.ort ?? null,
    unter16: m?.unter_16 ?? true,
    elternErlauben: !!m?.eltern_erlauben,
    wirdAngezeigt: !!m?.wird_angezeigt,
  };
  // Kinderkonto unter 16: Eltern verknuepfen; volljaehrig (18): Elternfunktionen; 16/17: eigenes Konto ohne Elternfunktionen
  const alter = geburtsdatum ? alterAm(String(geburtsdatum), heuteBerlin()) : null;
  const kinderkonto = alter === null || alter < KINDERKONTO_BIS;
  const volljaehrig = alter !== null && alter >= VOLLJAEHRIG_AB;
  const [kinder, eltern, schutz] = await Promise.all([
    volljaehrig ? getMeineKinder(supabase) : Promise.resolve([]),
    kinderkonto ? getMeineEltern(supabase) : Promise.resolve([]),
    kinderkonto ? getMeineSchutzEinstellungen(supabase) : Promise.resolve(null),
  ]);
  const hinweis = email ? HINWEISE[email] : undefined;

  // „Mein Tarif & Lizenz“ (kompakt): nur fuer BASIC und VEREIN
  const { data: tarifRoh } = await supabase.rpc("mein_tarif_status");
  const ts = tarifRoh as MeinTarifStatus | null;
  let lizenz: { tarif: string; status: string; bis: string; art: string; hinweis: string | null } | null = null;
  if (ts?.zugang && (ts.zugang.effektiv === "basic" || ts.zugang.effektiv === "verein") && !ts.zugang.plattform_admin) {
    const abo = ts.abos[0];
    const ueberVerein = ts.zugang.vereinszugang;
    const bis = ueberVerein ? (ts.vereinslizenz_bis ?? null) : abo?.periode === "unbefristet" ? null : (abo?.gekuendigt_zum ?? abo?.laeuft_bis ?? null);
    const st = lizenzStatus(ts.zugang.effektiv, bis);
    const endet = ueberVerein || !abo || abo.status === "cancelled" || abo.anbieter === "manuell" || abo.anbieter === "ueberweisung";
    lizenz = {
      tarif: ts.zugang.effektiv,
      status: st.text,
      bis: bis ? tarifDatum(bis) : "unbefristet",
      art: ueberVerein ? `Vereinslizenz · ${ts.verein_name ?? ""}` : abo?.lizenzart ? (LIZENZART_LABEL[abo.lizenzart] ?? abo.lizenzart) : "–",
      hinweis:
        endet && st.stufe === "bald" && st.tage !== null
          ? `🟠 ${ueberVerein ? "Die Vereinslizenz" : "Deine BASIC-Lizenz"} ist noch ${st.tage === 1 ? "1 Tag" : `${st.tage} Tage`} gültig.`
          : null,
    };
  }

  // „Meine Navigation“: nur die Bereiche, die diese Person ohnehin sehen darf (gleiche Logik wie das Menue)
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  const echterZugriff = await getZugriff(supabase, istAdmin === true);
  // „Ansicht als …“ der Administration: dieselbe Menue-Grundlage wie das Layout (Beispielrechte, Standardreihenfolge)
  const ansicht = await aktiveAnsicht();
  const zugriff = ansicht
    ? { ...ansichtZugriff(ansicht), musikAn: echterZugriff.musikAn, spotlightsAn: echterZugriff.spotlightsAn, juryraum: false, reihenfolge: null, navTarife: echterZugriff.navTarife }
    : echterZugriff;
  // Admin-Navigation: ausgeblendete Punkte trotzdem in der Liste zeigen (zum Wieder-Einblenden)
  const listenZugriff = zugriff.istPlattformAdmin ? { ...zugriff, ausgeblendet: null } : zugriff;
  const naviPunkte: NaviPunkt[] = navGruppen(listenZugriff)
    .filter((g) => !SYSTEM_NAV.has(g.eintrag.href))
    .map((g) => ({ href: g.eintrag.href, label: g.eintrag.label, unterpunkte: g.unterpunkte.map((u) => ({ href: u.href, label: u.label })) }));
  const naviSystem = erlaubteNav(listenZugriff).filter((n) => SYSTEM_NAV.has(n.href)).map((n) => ({ href: n.href, label: n.label }));

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Einstellungen</h1>
        <p className="text-[14px] text-brand-ink-soft">Konto und Sicherheit</p>
      </div>

      {hinweis && <p className="rounded-lg bg-brand-green-wash px-3 py-2 text-[13px] text-brand-green">{hinweis}</p>}

      <TanzRaumAssistant
        variant="setup"
        size="kompakt"
        dismissKey="einstellungen-hinweis"
        message="Nicht sicher, was du hier einstellen solltest? Ich gehe die wichtigsten Punkte Schritt für Schritt mit dir durch – du entscheidest."
        actions={<KaiStarten />}
      />

      {lizenz && (
        <section className={`${KARTE} scroll-mt-4`} id="lizenz">
          <KarteKopf icon={CreditCard} titel="Mein Tarif & Lizenz" untertitel="Dein Zugang und wie lange er gilt" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13.5px] sm:grid-cols-4">
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Tarif</div>
              <div className="font-bold text-brand-ink">{lizenz.tarif.toUpperCase()}</div>
            </div>
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Status</div>
              <div className="font-bold text-brand-ink">{lizenz.status}</div>
            </div>
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Gültig bis</div>
              <div className="font-bold text-brand-ink">{lizenz.bis}</div>
            </div>
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-wide text-brand-ink-soft">Art</div>
              <div className="font-bold text-brand-ink">{lizenz.art}</div>
            </div>
          </div>
          {lizenz.hinweis && <p className="mt-2 rounded-xl bg-brand-gold-wash px-3 py-2 text-[13px] font-semibold text-brand-ink">{lizenz.hinweis}</p>}
          <Link href="/dashboard/tarif" className="mt-2 inline-block text-[13px] font-semibold text-brand-red">
            Details, Verlängerung und Tarife →
          </Link>
        </section>
      )}

      <section className={KARTE}>
        <KarteKopf
          icon={Mail}
          titel="E-Mail-Adresse"
          untertitel="Zur Sicherheit bestätigst du die Änderung per Link – an deine bisherige und an deine neue Adresse."
        />
        <EmailAendern aktuell={user.email ?? "–"} ausstehend={user.new_email ?? null} />
      </section>

      <section className={`${KARTE} scroll-mt-4`} id="navigation">
        <KarteKopf
          icon={ListOrdered}
          titel={zugriff.istPlattformAdmin ? "Admin-Navigation" : "Meine Navigation"}
          untertitel={zugriff.istPlattformAdmin ? "Reihenfolge und Sichtbarkeit deiner Admin-Menüpunkte" : "Personalisierung – Reihenfolge deiner Menüpunkte"}
        />
        <MeineNavigation
          start={naviPunkte}
          system={naviSystem}
          angepasst={!!zugriff.reihenfolge?.length || !!zugriff.ausgeblendet?.length}
          admin={zugriff.istPlattformAdmin}
          ausgeblendet={zugriff.ausgeblendet ?? []}
        />
      </section>

      <section className={`${KARTE} scroll-mt-4`} id="profil">
        <KarteKopf icon={UserRound} titel="Geschlecht" untertitel="Für die Bezeichnung in deinem Profil und in Mitgliederlisten, z. B. Tänzerin oder Tänzer." />
        <GeschlechtAuswahl modus="aendern" aktuell={(geschlecht as string | null) ?? null} />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={Building2} titel="Mein Verein im Profil" untertitel="Freiwillige Angabe – jederzeit änderbar oder löschbar." />
        <VereinAngabe wert={angaben.verein_angabe ?? null} />
      </section>

      <section className={`${KARTE} scroll-mt-4`} id="privatsphaere">
        <KarteKopf icon={EyeOff} titel="Privatsphäre" />
        <PrivatSchalter privat={!!profil?.konto_privat} />
      </section>

      <section className={KARTE} id="online">
        <KarteKopf icon={Radio} titel="Online-Status" />
        <OnlineSchalter sichtbar={!!angaben.online_sichtbar} />
      </section>

      <section className={KARTE} id="map">
        <KarteKopf icon={MapIcon} titel="TanzRaum Map" untertitel="Zeig anderen, wo du tanzt – freiwillig und nur mit Ort." />
        <MapEinstellungen stand={mapStand} />
      </section>

      <section className={KARTE}>
        {kinderkonto && schutz ? (
          <>
            <KarteKopf icon={Users} titel="Familie" untertitel="Eltern mit deinem Konto verknüpfen" />
            <ElternCode eltern={eltern} schutz={schutz} />
          </>
        ) : !volljaehrig ? (
          <>
            <KarteKopf icon={Users} titel="Familie" />
            <p className="text-[13.5px] text-brand-ink-soft">
              Ab 16 Jahren verwaltest du dein TanzRaum-Konto selbst. Elternfunktionen (Kinderkonten verknüpfen) gibt es ab 18 Jahren.
            </p>
          </>
        ) : (
          <>
            <KarteKopf icon={Users} titel="Familie" untertitel="Kinderkonten verknüpfen und Einstellungen für deine Kinder" />
            <div className="flex flex-col gap-4">
              <MeineKinder kinder={kinder} />
              <KindVerknuepfen />
            </div>
          </>
        )}
      </section>

      <section className={KARTE} id="push">
        <KarteKopf icon={Bell} titel="Push-Benachrichtigungen" untertitel="Auf welchem Gerät und wofür du benachrichtigt wirst." />
        <div className="-mx-4">
          <PushSchalter />
        </div>
        <PushKategorien stand={pushStand} />
      </section>

      <section className={KARTE}>
        <KarteKopf
          icon={KeyRound}
          titel="Passwort"
          untertitel="Nach der Änderung wirst du auf allen anderen Geräten abgemeldet. Wir informieren dich zusätzlich per E-Mail."
        />
        <PasswortAendern />
        <p className="mt-3 text-[12.5px] text-brand-ink-soft">
          Passwort vergessen? <Link href="/passwort-vergessen" className="font-semibold text-brand-red">Link zum Zurücksetzen anfordern</Link>
        </p>
      </section>

      <section className={KARTE} id="datenschutz">
        <KarteKopf icon={ShieldCheck} titel="Datenschutz" untertitel="Deine Einwilligungen – jede Änderung wird mit Zeitpunkt und Fassung festgehalten." />
        <EinwilligungsVerlauf liste={(einwilligungen ?? []) as Einwilligung[]} />
        <div className="mt-4 flex flex-col gap-2 border-t border-brand-line pt-4">
          <h3 className="text-[14px] font-bold text-brand-ink">Meine Daten</h3>
          <p className="text-[13px] text-brand-ink-soft">
            Lade alle Daten herunter, die TanzRaum zu deinem Konto speichert (JSON-Datei). Daten anderer Personen sind nicht enthalten.
          </p>
          <a
            href="/dashboard/einstellungen/export"
            className="inline-flex min-h-10 items-center self-start rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            Datenexport herunterladen
          </a>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-brand-line pt-4">
          <h3 className="text-[14px] font-bold text-brand-ink">Konto löschen</h3>
          <KontoLoeschen hindernisse={hindernisse} />
        </div>
      </section>
    </div>
  );
}
