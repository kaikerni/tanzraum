import Link from "next/link";
import { RechtsLinks } from "@/components/recht/RechtsLinks";
import { redirect } from "next/navigation";
import { Mail, KeyRound, EyeOff, Users, Map as MapIcon, UserRound } from "lucide-react";
import { MapEinstellungen } from "@/components/einstellungen/MapEinstellungen";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EmailAendern, PasswortAendern, PrivatSchalter } from "@/components/einstellungen/KontoSicherheit";
import { GeschlechtAuswahl } from "@/components/einstellungen/GeschlechtAuswahl";
import { ElternCode, KindVerknuepfen, MeineKinder } from "@/components/familie/Familie";
import { alterAm, getMeineEltern, getMeineKinder, getMeineSchutzEinstellungen } from "@/lib/familie/getFamilie";
import { heuteBerlin } from "@/lib/training/getTraining";
import { KINDERKONTO_BIS, VOLLJAEHRIG_AB } from "@/lib/auth/alter";

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
  const [{ data: profil }, { data: geburtsdatum }, { data: geschlecht }] = await Promise.all([
    supabase.from("profiles").select("konto_privat").eq("id", user.id).maybeSingle(),
    supabase.rpc("mein_geburtsdatum"),
    supabase.rpc("mein_geschlecht"),
  ]);
  const { data: mapDaten } = await supabase.rpc("meine_map_einstellungen");
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

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Einstellungen</h1>
        <p className="text-[14px] text-brand-ink-soft">Konto und Sicherheit</p>
      </div>

      {hinweis && <p className="rounded-lg bg-brand-green-wash px-3 py-2 text-[13px] text-brand-green">{hinweis}</p>}

      <section className={KARTE}>
        <KarteKopf
          icon={Mail}
          titel="E-Mail-Adresse"
          untertitel="Zur Sicherheit bestätigst du die Änderung per Link – an deine bisherige und an deine neue Adresse."
        />
        <EmailAendern aktuell={user.email ?? "–"} ausstehend={user.new_email ?? null} />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={UserRound} titel="Geschlecht" untertitel="Für die Bezeichnung in deinem Profil und in Mitgliederlisten, z. B. Tänzerin oder Tänzer." />
        <GeschlechtAuswahl modus="aendern" aktuell={(geschlecht as string | null) ?? null} />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={EyeOff} titel="Privatsphäre" />
        <PrivatSchalter privat={!!profil?.konto_privat} />
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
      <RechtsLinks className="justify-center" />
    </div>
  );
}
