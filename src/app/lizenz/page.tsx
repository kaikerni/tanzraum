import Link from "next/link";
import { RechtsSeite, Abschnitt } from "@/components/recht/RechtsSeite";
import { createClient } from "@/lib/supabase/server";
import { getAnbieter } from "@/lib/recht/anbieter";
import { euro, getPreise, gratisMonate } from "@/lib/tarife";

export const metadata = { title: "Lizenzen" };
// Preise live aus tarif_preise
export const revalidate = 300;

// Kurzinfo zu den Lizenzen; verbindlich sind die Nutzungsbedingungen
export default async function LizenzSeite() {
  const supabase = await createClient();
  const [preise, a] = await Promise.all([getPreise(supabase), getAnbieter()]);

  return (
    <RechtsSeite titel="Lizenzen" stand={null}>
      <p className="text-[14px] text-brand-ink">
        TanzRaum gibt es als FREE, BASIC und VEREIN. Hier findest du die Lizenzen im Überblick. Verbindlich sind die{" "}
        <Link href="/nutzungsbedingungen" className="text-brand-red underline">
          Nutzungsbedingungen
        </Link>
        .
      </p>

      <Abschnitt titel="FREE">
        <p>Kostenlos – ohne Laufzeit und ohne Zahlungsdaten.</p>
      </Abschnitt>

      <Abschnitt titel="BASIC – persönliche Lizenz">
        {preise ? (
          <p>
            {euro(preise.basic.monat)} pro Monat oder {euro(preise.basic.jahr)} pro Jahr
            {gratisMonate(preise, "basic") > 0 ? ` (jährlich bezahlt: ${gratisMonate(preise, "basic")} Monate gratis)` : ""}.
          </p>
        ) : (
          <p>Die aktuellen Preise können gerade nicht geladen werden.</p>
        )}
        <p>
          Bist du über die Vereinslizenz deines Vereins abgedeckt, wird deine BASIC-Lizenz pausiert (keine Abbuchung) und läuft nach dem
          Ende der Vereinsabdeckung automatisch weiter.
        </p>
      </Abschnitt>

      <Abschnitt titel="VEREIN – Vereinslizenz">
        {preise ? (
          <p>
            {euro(preise.verein.monat)} pro Monat oder {euro(preise.verein.jahr)} pro Jahr
            {gratisMonate(preise, "verein") > 0 ? ` (jährlich bezahlt: ${gratisMonate(preise, "verein")} Monate gratis)` : ""}.
          </p>
        ) : (
          <p>Die aktuellen Preise können gerade nicht geladen werden.</p>
        )}
        <p>
          Die Vereinslizenz kauft ein Vereinsadmin für seinen Verein. Sie gilt ohne Begrenzung der Mitgliederzahl für alle aktiven Mitglieder
          des Vereins. Wer aus dem Verein entfernt oder deaktiviert wird, ist nicht mehr abgedeckt.
        </p>
      </Abschnitt>

      <Abschnitt titel="Zahlung, Laufzeit, Kündigung">
        <ul>
          <li>Bezahlt wird im Voraus über Stripe (Karte/Lastschrift), PayPal oder per Banküberweisung.</li>
          <li>Eine Lizenz wird erst freigeschaltet, wenn die Zahlung bestätigt ist.</li>
          <li>Lizenzen verlängern sich automatisch um die gewählte Laufzeit (Monat bzw. Jahr). Du kannst jederzeit kündigen; die Lizenz bleibt bis zum Ende des bezahlten Zeitraums aktiv, danach gilt wieder FREE.</li>
          <li>Verbraucher haben ein gesetzliches Widerrufsrecht (siehe Widerrufsbelehrung in den Nutzungsbedingungen).</li>
        </ul>
        {a && <p>Alle Preise sind Endpreise.{a.kleinunternehmer ? ` ${a.kleinunternehmerHinweis}` : " Sie enthalten die gesetzliche Umsatzsteuer."}</p>}
        <p>
          Deine Lizenz verwaltest du unter{" "}
          <Link href="/dashboard/tarif" className="text-brand-red underline">
            Mein Tarif
          </Link>
          .
        </p>
      </Abschnitt>
    </RechtsSeite>
  );
}
