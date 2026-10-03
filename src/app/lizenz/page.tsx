import Link from "next/link";
import { RechtsSeite, Abschnitt } from "@/components/recht/RechtsSeite";
import { createClient } from "@/lib/supabase/server";
import { getAnbieter } from "@/lib/recht/anbieter";
import { euro, getPreise, jahrHinweis } from "@/lib/tarife";
import { ABDECKUNG_ENDE_TEXT, BASIC_PAUSE_TEXT, KEIN_BASIC_NOETIG_TEXT, MITGLIEDERIMPORT_TEXT, TARIF_EINLEITUNG, TARIF_LEISTUNGEN, TURNIER_ANMELDUNG_HINWEIS, VEREINSLIZENZ_TEXT } from "@/lib/tarif-leistungen";

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
        <p>{TURNIER_ANMELDUNG_HINWEIS}</p>
      </Abschnitt>

      <Abschnitt titel="BASIC – persönliche Lizenz">
        {preise ? (
          <p>
            {euro(preise.basic.monat)} pro Monat oder {euro(preise.basic.jahr)} pro Jahr. {jahrHinweis(preise, "basic")}
          </p>
        ) : (
          <p>Die aktuellen Preise können gerade nicht geladen werden.</p>
        )}
        <p>{TARIF_EINLEITUNG.basic}</p>
        <ul>
          {TARIF_LEISTUNGEN.basic.filter((l) => !l.bald).map((l) => (
            <li key={l.text}>{l.text}</li>
          ))}
        </ul>
        <p>{BASIC_PAUSE_TEXT}</p>
      </Abschnitt>

      <Abschnitt titel="VEREIN – Vereinslizenz">
        {preise ? (
          <p>
            {euro(preise.verein.monat)} pro Monat oder {euro(preise.verein.jahr)} pro Jahr. {jahrHinweis(preise, "verein")}
          </p>
        ) : (
          <p>Die aktuellen Preise können gerade nicht geladen werden.</p>
        )}
        <p>{VEREINSLIZENZ_TEXT} Abgeschlossen wird sie von einem Vereinsadmin für seinen Verein.</p>
        <p>{KEIN_BASIC_NOETIG_TEXT}</p>
        <p>{ABDECKUNG_ENDE_TEXT}</p>
        <p>
          <strong>VEREIN enthält unter anderem:</strong> {TARIF_EINLEITUNG.verein}
        </p>
        <ul>
          {TARIF_LEISTUNGEN.verein.filter((l) => !l.bald).map((l) => (
            <li key={l.text}>{l.text}</li>
          ))}
        </ul>
        <p>
          <strong>Mitglieder einfach übernehmen:</strong> {MITGLIEDERIMPORT_TEXT}
        </p>
      </Abschnitt>

      <Abschnitt titel="Zahlung, Laufzeit, Kündigung">
        <ul>
          <li>
            Bezahlt wird im Voraus: BASIC per Karte (auch Apple Pay/Google Pay), SEPA-Lastschrift (beides über Stripe) oder
            PayPal; die Vereinslizenz per SEPA-Lastschrift (über Stripe), PayPal oder Banküberweisung.
          </li>
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
