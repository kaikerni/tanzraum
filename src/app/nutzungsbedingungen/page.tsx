import Link from "next/link";
import { RechtsSeite, Abschnitt, Todo } from "@/components/recht/RechtsSeite";
import { createClient } from "@/lib/supabase/server";
import { euro, getPreise } from "@/lib/tarife";

export const metadata = { title: "Nutzungsbedingungen" };
// Preise live aus tarif_preise (nicht beim Build einfrieren)
export const revalidate = 300;

export default async function NutzungsbedingungenSeite() {
  const supabase = await createClient();
  const preise = await getPreise(supabase);

  return (
    <RechtsSeite titel="Nutzungsbedingungen">
      <Abschnitt titel="1. Anbieter und Geltungsbereich">
        <p>
          TanzRaum ist eine Plattform für den karnevalistischen Tanzsport. Anbieter ist <Todo>Name/Firma und Anschrift wie im Impressum</Todo>.
          Diese Bedingungen gelten für alle, die ein TanzRaum-Konto nutzen.
        </p>
      </Abschnitt>

      <Abschnitt titel="2. Konto">
        <ul>
          <li>Für die Nutzung brauchst du ein Konto mit wahren Angaben, insbesondere einem korrekten Geburtsdatum.</li>
          <li>Halte deine Zugangsdaten geheim. Dein Passwort verwaltet ausschließlich die Anmeldung (Supabase Auth).</li>
          <li>
            <Todo>Mindestalter und Regeln für Minderjährige (Zustimmung der Eltern) festlegen</Todo>
          </li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="3. Tarife">
        <ul>
          <li>
            <strong>FREE</strong> – kostenlos.
          </li>
          <li>
            <strong>BASIC</strong> – persönlicher Tarif
            {preise && (
              <>
                : {euro(preise.basic.monat)} pro Monat oder {euro(preise.basic.jahr)} pro Jahr
              </>
            )}
            .
          </li>
          <li>
            <strong>VEREIN</strong> – Vereinslizenz für einen Verein
            {preise && (
              <>
                : {euro(preise.verein.monat)} pro Monat oder {euro(preise.verein.jahr)} pro Jahr
              </>
            )}
            . Die Lizenz kauft ein Vereinsadmin für seinen Verein. Sie gilt ohne Begrenzung der Mitgliederzahl für alle aktiven
            Mitglieder des Vereins. Wer aus dem Verein entfernt oder deaktiviert wird, ist nicht mehr abgedeckt.
          </li>
          <li>
            Hast du ein eigenes BASIC-Abo und bist über eine Vereinslizenz abgedeckt, wird dein BASIC-Abo pausiert (keine Abbuchung) und
            läuft nach dem Ende der Vereinsabdeckung automatisch weiter. Es wird dabei weder gelöscht noch neu abgeschlossen.
          </li>
          <li>
            Einzelne Bereiche, die als „In Arbeit“ gekennzeichnet sind, sind noch nicht Teil des Leistungsumfangs.
            <Todo>Leistungsbeschreibung je Tarif verbindlich festlegen</Todo>
          </li>
        </ul>
        <p>
          <Todo>Angaben zur Umsatzsteuer bei den Preisen ergänzen</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="4. Zahlung, Laufzeit und Kündigung">
        <ul>
          <li>Bezahlt wird im Voraus über Stripe (Karte/Lastschrift) oder PayPal.</li>
          <li>
            Ein Tarif wird erst freigeschaltet, wenn der Zahlungsanbieter die Zahlung bestätigt hat. Schlägt eine Zahlung fehl, wird der
            Tarif nicht aktiviert bzw. als „Zahlung offen“ geführt.
          </li>
          <li>
            Abos verlängern sich automatisch um die gewählte Laufzeit (Monat bzw. Jahr). Du kannst jederzeit unter{" "}
            <Link href="/dashboard/tarif" className="text-brand-red underline">
              Mein Tarif
            </Link>{" "}
            kündigen; der Tarif bleibt bis zum Ende des bezahlten Zeitraums aktiv. Danach gilt wieder FREE – dein Konto und deine Daten
            bleiben erhalten.
          </li>
          <li>
            <Todo>Regelung zu Preisänderungen ergänzen</Todo>
          </li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="5. Widerrufsrecht">
        <p>
          <Todo>Widerrufsbelehrung für Verbraucher und Muster-Widerrufsformular einfügen (rechtlich prüfen lassen)</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="6. Verhalten auf TanzRaum">
        <ul>
          <li>Respektvoller Umgang – keine Belästigung, Beleidigung, Bedrohung oder Diskriminierung.</li>
          <li>Keine rechtswidrigen, sexualisierten oder gewaltverherrlichenden Inhalte, keine Werbung oder Spam.</li>
          <li>
            Besonderer Schutz von Kindern und Jugendlichen: Die Schutzregeln (z. B. zur Kontaktaufnahme durch Fremde) dürfen nicht
            umgangen werden.
          </li>
          <li>Personen und Inhalte kannst du melden; die TanzRaum-Administration prüft Meldungen und kann Konten sperren.</li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="7. Deine Inhalte">
        <p>
          Du bist für die Inhalte verantwortlich, die du einstellst, und brauchst die nötigen Rechte daran (z. B. an Fotos und Musik).
          Du räumst TanzRaum nur die Rechte ein, die nötig sind, um die Inhalte im Rahmen der Plattform anzuzeigen und zu übermitteln.
        </p>
      </Abschnitt>

      <Abschnitt titel="8. Verfügbarkeit und Haftung">
        <p>
          <Todo>Regelungen zu Verfügbarkeit, Datensicherung und Haftung ergänzen (rechtlich prüfen lassen)</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="9. Änderungen und Schlussbestimmungen">
        <p>
          <Todo>Verfahren für Änderungen dieser Bedingungen, anwendbares Recht, Gerichtsstand</Todo>
        </p>
        <p>
          Informationen zum Datenschutz findest du in der{" "}
          <Link href="/datenschutz" className="text-brand-red underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </Abschnitt>
    </RechtsSeite>
  );
}
