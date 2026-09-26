import Link from "next/link";
import { RechtsSeite, Abschnitt, Todo } from "@/components/recht/RechtsSeite";

export const metadata = { title: "Datenschutzerklärung" };

// Aufgefuehrt sind nur Dienste, die TanzRaum tatsaechlich nutzt (Stand des Codes). Wird ein Dienst
// hinzugefuegt oder entfernt, muss dieser Text angepasst werden.
export default function DatenschutzSeite() {
  return (
    <RechtsSeite titel="Datenschutzerklärung">
      <p className="text-[14px] text-brand-ink">
        Hier erfährst du, welche personenbezogenen Daten TanzRaum verarbeitet, wofür und an wen sie weitergegeben werden.
      </p>

      <Abschnitt titel="1. Verantwortlicher">
        <p>
          Kai Kern, Taktmanufaktur, Jahnstraße 15, 67378 Zeiskam
          <br />
          Telefon: 0176 55101261
          <br />
          E-Mail: <a href="mailto:info@tanzraum.app" className="text-brand-red underline">info@tanzraum.app</a>
        </p>
        <p>
          Ein Datenschutzbeauftragter ist nicht benannt, da hierfür keine gesetzliche Pflicht besteht.
        </p>
        <p>
          Vereine, die TanzRaum für ihre Vereinsverwaltung nutzen, verarbeiten die Daten ihrer Mitglieder in eigener
          Verantwortung. Für diese Vereinsdaten ist der jeweilige Verein Verantwortlicher; TanzRaum verarbeitet sie in seinem Auftrag
          (Art. 28 DSGVO). Anfragen zu diesen Daten richtest du am besten direkt an deinen Verein.
        </p>
      </Abschnitt>

      <Abschnitt titel="2. Hosting der Web-App">
        <p>
          Die Web-App wird auf einem Server der netcup GmbH (Daimlerstraße 25, 76185 Karlsruhe) mit Standort in der EU betrieben. Beim Aufruf werden technisch notwendige
          Daten verarbeitet (IP-Adresse, Zeitpunkt, aufgerufene Seite, Browserangaben), um die Seite auszuliefern und abzusichern.
          Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </Abschnitt>

      <Abschnitt titel="3. Datenbank, Anmeldung und Dateien (Supabase)">
        <p>
          Konto, Anmeldung, Datenbank, Dateiablage und Serverfunktionen laufen über Supabase (Supabase Inc., USA) mit Datenstandort in
          der EU (Frankfurt am Main). Passwörter werden ausschließlich von Supabase Auth verarbeitet und nur als Hash gespeichert –
          TanzRaum verschickt niemals Passwörter per E-Mail. Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung. Für mögliche
          Zugriffe aus den USA gelten die EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).
        </p>
      </Abschnitt>

      <Abschnitt titel="4. Konto und Profil">
        <ul>
          <li>Pflichtangaben: Name, E-Mail-Adresse, Passwort, Geburtsdatum.</li>
          <li>
            Das Geburtsdatum wird nie öffentlich angezeigt. Es dient dazu, Schutzregeln für Kinder und Jugendliche anzuwenden
            (z. B. wer Minderjährigen Nachrichten schreiben darf) und Eltern mit ihren Kindern zu verknüpfen.
          </li>
          <li>Freiwillige Angaben: Profilbild, Beschreibung, Vereins- und Tanzangaben, Kontaktdaten.</li>
        </ul>
        <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag).</p>
      </Abschnitt>

      <Abschnitt titel="5. Kinder und Jugendliche">
        <p>
          Für Minderjährige gelten in TanzRaum eigene Schutzregeln (eingeschränkte Kontaktaufnahme durch Fremde, Eltern-Verknüpfung,
          Meldefunktion). Diese Schutzregeln sind unabhängig davon, ab welchem Alter jemand nach Datenschutzrecht selbst einwilligen kann.
        </p>
        <p>
          <Todo>Rechtsgrundlage und ggf. Zustimmung der Eltern für Nutzer unter 16 Jahren (Art. 8 DSGVO) rechtlich prüfen und hier beschreiben</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="6. Netzwerk und Karte">
        <ul>
          <li>
            Auf der Karte erscheinst du nur, wenn du das selbst einschaltest. Angezeigt werden höchstens PLZ und Ort (Mittelpunkt des
            Ortes) – niemals Straße oder Hausnummer.
          </li>
          <li>
            Orte und Adressen werden über den Dienst Nominatim der OpenStreetMap Foundation (Vereinigtes Königreich) in Koordinaten
            umgerechnet. Die Anfrage stellt unser Server, nicht dein Browser.
          </li>
          <li>
            Kartenbilder lädt dein Browser von OpenFreeMap (tiles.openfreemap.org); geteilte Standorte in Nachrichten zeigen ein
            Kartenbild von OpenStreetMap (tile.openstreetmap.org). Dabei wird deine IP-Adresse an diese Anbieter übertragen.
          </li>
        </ul>
        <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Sichtbarkeit auf der Karte) bzw. lit. f (Kartendarstellung).</p>
      </Abschnitt>

      <Abschnitt titel="7. Nachrichten und Anrufe">
        <ul>
          <li>
            Nachrichten, Sprachnachrichten, Bilder und Dateien werden in der Datenbank bzw. Dateiablage gespeichert. Die
            TanzRaum-Administration liest keine privaten Chats; nur gemeldete Inhalte werden zur Prüfung angezeigt.
          </li>
          <li>
            Sprach- und Videoanrufe laufen direkt zwischen den Geräten (WebRTC). Für den Verbindungsaufbau werden STUN-Server von
            Cloudflare und Google genutzt; ist keine direkte Verbindung möglich, wird der Anruf verschlüsselt über Cloudflare Realtime
            (TURN) weitergeleitet. Dabei werden IP-Adressen verarbeitet.
          </li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="8. Push-Benachrichtigungen">
        <p>
          Wenn du Benachrichtigungen erlaubst, speichern wir die Push-Adresse deines Browsers. Die Benachrichtigung wird über den
          Push-Dienst deines Browser-Herstellers zugestellt (z. B. Google, Apple, Mozilla, Microsoft). Die Push-Nachricht selbst
          enthält keinen Inhalt – dein Gerät holt Titel und Vorschau danach direkt bei TanzRaum ab. Du kannst Push jederzeit in
          den Browser-Einstellungen abschalten. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO.
        </p>
      </Abschnitt>

      <Abschnitt titel="9. E-Mails (Brevo)">
        <p>
          System-E-Mails (z. B. Bestätigung der Registrierung, Passwort zurücksetzen, Einladungen, Rechnungen, Vereinsrundschreiben)
          versenden wir über Brevo (Sendinblue GmbH, Berlin). Dabei werden E-Mail-Adresse, Name und der Inhalt der E-Mail verarbeitet.
          Versandprotokolle werden nach 90 Tagen gelöscht.
        </p>
      </Abschnitt>

      <Abschnitt titel="10. Zahlungen (Stripe, PayPal, Banküberweisung)">
        <p>
          Kostenpflichtige Tarife (BASIC, VEREIN) bezahlst du über Stripe (Stripe Payments Europe, Ltd., Irland; Karte oder
          Lastschrift) oder PayPal (PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg). Deine Zahlungsdaten gibst du direkt beim
          jeweiligen Anbieter ein; TanzRaum erhält keine Karten- oder Kontodaten, sondern nur die Abo-Kennung, den Zahlungsstatus,
          die Laufzeit und die Kunden-Kennung des Anbieters. Bei Zahlung per Banküberweisung verarbeiten wir die Angaben aus dem
          Zahlungseingang (Name, IBAN, Betrag, Verwendungszweck), um die Zahlung zuzuordnen. Für Rechnungen speichern wir Name, Tarif,
          Betrag und Zahlungsweg.
        </p>
        <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b und c DSGVO (Vertrag, steuerliche Aufbewahrungspflichten).</p>
      </Abschnitt>

      <Abschnitt titel="11. KI-Assistent (nur TanzRaum-Administration)">
        <p>
          Der TanzRaum-Assistent steht nur der Plattform-Administration zur Verfügung. Die gestellte Frage und ausgewählte Verwaltungsdaten
          (z. B. Kennzahlen, anstehende Termine, offene Beiträge mit Namen, Trainingsabmeldungen) werden an die Gemini API von Google
          übermittelt, um eine Antwort zu erzeugen.{" "}
          <Todo>Anbieter/Vertragspartner (Google), Auftragsverarbeitung, Drittlandübermittlung und Rechtsgrundlage prüfen</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="12. Cookies und lokaler Speicher">
        <p>
          TanzRaum setzt nur technisch notwendige Cookies für die Anmeldung. Im lokalen Speicher deines Browsers merken wir uns
          Bedienvorlieben (z. B. zuletzt genutzte Smileys). Es gibt keine Werbe- oder Analyse-Tracker. Schriftarten werden von TanzRaum
          selbst ausgeliefert.
        </p>
      </Abschnitt>

      <Abschnitt titel="13. Externe Links">
        <p>
          Links zu Google Maps oder Google Kalender öffnen die Seiten des jeweiligen Anbieters erst, wenn du sie anklickst. Dann gilt
          dessen Datenschutzerklärung.
        </p>
      </Abschnitt>

      <Abschnitt titel="14. Speicherdauer">
        <p>Wir speichern Daten, solange dein Konto besteht oder es für den jeweiligen Zweck nötig ist:</p>
        <ul>
          <li>Konto-, Profil- und Nachrichtendaten: bis zur Löschung deines Kontos (bzw. bis du einzelne Inhalte löschst).</li>
          <li>Vereinsdaten: solange der Verein sie benötigt bzw. bis der Verein sie entfernt.</li>
          <li>Rechnungen und Buchungsbelege: 8 Jahre (§ 147 Abgabenordnung).</li>
          <li>E-Mail-Versandprotokolle: 90 Tage.</li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="15. Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch
          (Art. 15–21 DSGVO). Erteilte Einwilligungen kannst du jederzeit für die Zukunft widerrufen. Für diese Anliegen und die
          Löschung deines Kontos schreib uns an{" "}
          <a href="mailto:info@tanzraum.app" className="text-brand-red underline">info@tanzraum.app</a>.
        </p>
        <p>
          Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, z. B. bei der für uns zuständigen Behörde: Der
          Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz, Hintere Bleiche 34, 55116 Mainz.
        </p>
        <p>
          Siehe auch die <Link href="/nutzungsbedingungen" className="text-brand-red underline">Nutzungsbedingungen</Link>.
        </p>
      </Abschnitt>
    </RechtsSeite>
  );
}
