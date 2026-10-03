import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RechtsLinks } from "@/components/recht/RechtsLinks";
import { ZUSTIMMUNG_TEXTVERSION } from "@/lib/auth/alter";
import { ZustimmungFormular } from "./ZustimmungFormular";

export const metadata = { title: "Zustimmung für ein Kinderkonto – TanzRaum" };
export const dynamic = "force-dynamic";

function datum(wert: string) {
  const [j, m, t] = wert.split("-");
  return `${t}.${m}.${j}`;
}

// Zustimmung eines Elternteils bzw. Traegers der elterlichen Verantwortung – ohne eigenes TanzRaum-Konto,
// nur mit dem einmaligen, zeitlich begrenzten Link aus der E-Mail.
export default async function ElternZustimmungSeite({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const supabase = await createClient();
  const { data } = token ? await supabase.rpc("eltern_zustimmung_info", { p_token: token }) : { data: null };
  // deno-lint-ignore no-explicit-any
  const info = ((data ?? []) as any[])[0] as
    | { vorname: string | null; nachname: string | null; geburtsdatum: string | null; alter_jahre: number | null; textversion: string }
    | undefined;

  return (
    <div className="auth-page">
      <div className="auth-card max-w-[640px]">
        <h1 className="brand-font">Zustimmung für ein Kinderkonto</h1>
        {!info ? (
          <p className="form-error">
            Dieser Link ist ungültig, abgelaufen oder wurde bereits verwendet. Falls dein Kind einen neuen Link braucht, kann es ihn bei
            der Registrierung erneut anfordern. Fragen? <a href="mailto:info@tanzraum.app">info@tanzraum.app</a>
          </p>
        ) : info.textversion !== ZUSTIMMUNG_TEXTVERSION ? (
          <p className="form-error">Die Zustimmungsseite wird gerade aktualisiert. Bitte versuche es in ein paar Minuten erneut.</p>
        ) : (
          <div className="flex flex-col gap-4 text-[14px] leading-relaxed text-brand-ink">
            <p>
              <strong>{[info.vorname, info.nachname].filter(Boolean).join(" ") || "Ein Kind"}</strong>
              {info.geburtsdatum ? ` (geboren am ${datum(info.geburtsdatum)}, ${info.alter_jahre} Jahre)` : ""} hat sich bei TanzRaum
              registriert und deine E-Mail-Adresse als Adresse eines Elternteils angegeben. Für Personen unter 16 Jahren wird das
              eigene Konto erst freigeschaltet, wenn ein Elternteil bzw. Träger der elterlichen Verantwortung zustimmt.
            </p>
            <div className="rounded-xl bg-brand-bg p-3 text-[13.5px]">
              <p className="mb-1 font-semibold">Diese Schutzeinstellungen gelten für Kinderkonten unter 16:</p>
              <ul className="ml-5 list-disc">
                <li>Nachrichten nur mit Mitgliedern des eigenen Vereins und den Eltern – keine Kontaktanfragen an Fremde.</li>
                <li>Keine Anzeige auf der TanzRaum Map.</li>
                <li>Spotlights sind nur für den eigenen Verein und Kontakte sichtbar.</li>
                <li>Auffindbar nur über den genauen Nutzernamen.</li>
                <li>Push-Benachrichtigungen nur mit deiner Einwilligung (unten).</li>
              </ul>
              <p className="mt-2">
                Mit einem eigenen, verknüpften Elternkonto kannst du Karte und Spotlights später freigeben oder Nachrichten ganz
                abschalten. Die Zustimmung und deine Angaben werden gespeichert (Zeitpunkt, deine E-Mail-Adresse, Umfang, Version dieser
                Texte). Eine Identitätsprüfung findet nicht statt – maßgeblich ist deine Erklärung.
              </p>
            </div>
            <ZustimmungFormular token={token} vorname={info.vorname ?? ""} textversion={info.textversion} />
            <p className="text-[12.5px] text-brand-ink-soft">
              Du bist nicht Elternteil oder kennst das Kind nicht? Dann lehne ab – das neu angelegte Konto wird sofort gelöscht. Ohne
              Entscheidung wird es nach 14 Tagen automatisch gelöscht. Details: <Link href="/datenschutz">Datenschutzerklärung</Link>.
            </p>
          </div>
        )}
        <RechtsLinks className="mt-4 justify-center" />
      </div>
    </div>
  );
}
