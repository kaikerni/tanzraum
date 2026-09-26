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
          TanzRaum ist eine Plattform für den karnevalistischen Tanzsport. Anbieter ist Kai Kern, Taktmanufaktur, Jahnstraße 15, 67378 Zeiskam (siehe{" "}
          <Link href="/impressum" className="text-brand-red underline">
            Impressum
          </Link>
          ).
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
        <p>Alle Preise sind Endpreise. Gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.</p>
      </Abschnitt>

      <Abschnitt titel="4. Zahlung, Laufzeit und Kündigung">
        <ul>
          <li>Bezahlt wird im Voraus über Stripe (Karte/Lastschrift), PayPal oder per Banküberweisung.</li>
          <li>
            Ein Tarif wird erst freigeschaltet, wenn die Zahlung bestätigt ist (bei Banküberweisung nach Zahlungseingang). Schlägt eine Zahlung fehl, wird der
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
            Preisänderungen für laufende Abos teilen wir mindestens sechs Wochen vorher per E-Mail mit. Sie gelten erst ab der nächsten
            Verlängerung; bis dahin kannst du jederzeit kündigen.
          </li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="5. Widerrufsrecht">
        <p>Verbraucher haben ein gesetzliches Widerrufsrecht. Für Vereine und Unternehmen gilt es nicht.</p>
        <h3 className="pt-1 font-bold">Widerrufsbelehrung</h3>
        <p className="font-semibold">Widerrufsrecht</p>
        <p>
          Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt
          vierzehn Tage ab dem Tag des Vertragsabschlusses.
        </p>
        <p>
          Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Kai Kern, Taktmanufaktur, Jahnstraße 15, 67378 Zeiskam, Telefon 0176 55101261,
          E-Mail info@tanzraum.app) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren
          Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das
          jedoch nicht vorgeschrieben ist.
        </p>
        <p>
          Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der
          Widerrufsfrist absenden.
        </p>
        <p className="font-semibold">Folgen des Widerrufs</p>
        <p>
          Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der
          Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von
          uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag
          zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung
          verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde
          ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
        </p>
        <p>
          Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen
          Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich
          dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen
          Dienstleistungen entspricht.
        </p>
        <h3 className="pt-1 font-bold">Muster-Widerrufsformular</h3>
        <p>(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)</p>
        <p>
          An Kai Kern, Taktmanufaktur, Jahnstraße 15, 67378 Zeiskam, E-Mail: info@tanzraum.app
          <br />
          Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die
          Erbringung der folgenden Dienstleistung (*)
          <br />
          Bestellt am (*)/erhalten am (*)
          <br />
          Name des/der Verbraucher(s)
          <br />
          Anschrift des/der Verbraucher(s)
          <br />
          Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)
          <br />
          Datum
          <br />
          (*) Unzutreffendes streichen.
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
        <ul>
          <li>
            Wir bemühen uns um eine möglichst unterbrechungsfreie Erreichbarkeit, können diese aber nicht garantieren (z. B. bei Wartung
            oder technischen Störungen).
          </li>
          <li>Bitte bewahre wichtige Dateien und Unterlagen zusätzlich selbst auf.</li>
          <li>
            Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie nach
            dem Produkthaftungsgesetz. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den
            vertragstypischen, vorhersehbaren Schaden begrenzt. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.
          </li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="9. Änderungen und Schlussbestimmungen">
        <ul>
          <li>
            Wir können diese Bedingungen mit Wirkung für die Zukunft ändern, wenn dafür ein sachlicher Grund besteht (z. B. neue
            Funktionen oder Gesetzesänderungen). Änderungen teilen wir mindestens sechs Wochen vorher per E-Mail mit. Änderungen, die
            Leistung oder Preis wesentlich betreffen, gelten nur mit deiner Zustimmung; ansonsten kannst du bis zum Inkrafttreten kündigen.
          </li>
          <li>
            Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur, soweit dadurch
            keine zwingenden Verbraucherschutzvorschriften des Staates entzogen werden, in dem sie ihren gewöhnlichen Aufenthalt haben.
          </li>
        </ul>
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
