import Link from "next/link";
import { RechtsSeite, Abschnitt, Todo, AnbieterNichtVerfuegbar } from "@/components/recht/RechtsSeite";
import { anbieterZeile, getAnbieter, telefonLink } from "@/lib/recht/anbieter";
import { RECHTSTEXT_VERSION } from "@/lib/recht/versionen";

export const metadata = { title: "Datenschutzerklärung" };
export const dynamic = "force-dynamic";

// Aufgefuehrt sind nur Dienste, die TanzRaum tatsaechlich nutzt (Stand des Codes). Wird ein Dienst
// hinzugefuegt oder entfernt, muss dieser Text angepasst werden.
export default async function DatenschutzSeite() {
  const a = await getAnbieter();
  if (!a) {
    return (
      <RechtsSeite titel="Datenschutzerklärung" stand={RECHTSTEXT_VERSION.datenschutz}>
        <AnbieterNichtVerfuegbar />
      </RechtsSeite>
    );
  }
  const mail = (
    <a href={`mailto:${a.email}`} className="text-brand-red underline">
      {a.email}
    </a>
  );
  return (
    <RechtsSeite titel="Datenschutzerklärung" stand={RECHTSTEXT_VERSION.datenschutz}>
      <p className="text-[14px] text-brand-ink">
        Hier erfährst du, welche personenbezogenen Daten TanzRaum verarbeitet, wofür und an wen sie weitergegeben werden.
      </p>

      <Abschnitt titel="1. Verantwortlicher">
        <p>
          {anbieterZeile(a)}
          <br />
          {a.telefon && (
            <>
              Telefon: <a href={telefonLink(a.telefon)} className="text-brand-red underline">{a.telefon}</a>
              <br />
            </>
          )}
          E-Mail: {mail}
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
          <li>Pflichtangaben: Name, E-Mail-Adresse, Passwort, Geburtsdatum, Geschlecht; unter 16 Jahren zusätzlich die E-Mail-Adresse eines Elternteils.</li>
          <li>
            Das Geburtsdatum wird nie öffentlich angezeigt. Aus ihm berechnet unser Server das Alter, um zu entscheiden, ob ein
            eigenständiges Konto (ab 16 Jahren) oder ein Kinderkonto mit Zustimmung der Eltern (unter 16 Jahren) vorliegt, und um
            die Schutzregeln für Kinderkonten anzuwenden.
          </li>
          <li>
            Freiwillige Angaben: Profilbild, Beschreibung, Vereins- und Tanzangaben, Kontaktdaten sowie „Verein, in dem ich tanze“ (ein
            freier Text ohne offizielle Vereinszuordnung, jederzeit änderbar oder löschbar).
          </li>
          <li>
            Online-Status: Solange TanzRaum geöffnet ist, speichern wir etwa minütlich den Zeitpunkt deiner letzten Aktivität. Daraus
            entstehen nur Zahlen („12 gerade online“). Mit Namen sehen dich nur deine Kontakte und Mitglieder deines Vereins; das ist voreingestellt
            und lässt sich in den Einstellungen („Online-Status“) jederzeit ausschalten. Ausgeschaltet wirst du für andere Nutzer weder
            angezeigt noch mitgezählt. Konten unter 16 Jahren werden anderen Nutzern nie mit Namen gezeigt. Die TanzRaum-Administration sieht
            in der Benutzerverwaltung je Konto, ob es gerade online ist oder ob der Online-Status ausgeschaltet ist (dann nur diese
            Einstellung, keine Aktivität); ändern kann sie die Einstellung nicht.
          </li>
          <li>
            Meine Navigation: Wenn du die Reihenfolge deiner Menüpunkte änderst, speichern wir sie in deinem Konto, damit sie auf all
            deinen Geräten gilt. Welche Bereiche du sehen darfst, ändert sich dadurch nicht. Die Angabe wird gelöscht, wenn du auf
            Standard zurücksetzt oder dein Konto löschst.
          </li>
        </ul>
        <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag).</p>
      </Abschnitt>

      <Abschnitt titel="5. Kinder unter 16 Jahren (Kinderkonto)">
        <p>
          Ein eigenständiges TanzRaum-Konto ist ab 16 Jahren möglich. Für Personen unter 16 Jahren gibt es ein Kinderkonto, das erst
          genutzt werden kann, wenn ein Elternteil bzw. Träger der elterlichen Verantwortung zugestimmt hat.
        </p>
        <ul>
          <li>
            <strong>Ablauf:</strong> Das Kind registriert sich und gibt die E-Mail-Adresse eines Elternteils an. Das Konto wird angelegt,
            die Anmeldung bleibt aber gesperrt. Das Elternteil erhält einen einmaligen, zeitlich begrenzten Link und kann darüber –
            auch ohne eigenes TanzRaum-Konto – zustimmen oder ablehnen.
          </li>
          <li>
            <strong>Keine Identitätsprüfung:</strong> Es findet keine Ausweis- oder Identitätsprüfung statt. Grundlage ist die
            Erklärung des Elternteils über den an seine Adresse gesendeten Link, dass es volljährig und Träger der elterlichen
            Verantwortung ist. Zur Kontrolle erhält das Elternteil anschließend eine Bestätigung per E-Mail.
          </li>
          <li>
            <strong>Was wir zur Zustimmung speichern:</strong> Bezug zum Kinderkonto, die E-Mail-Adresse, an die der Link ging,
            Zeitpunkt der Anfrage und der Entscheidung, die abgegebenen Erklärungen, den Umfang der Zustimmung, die Version der
            Zustimmungstexte und den Zeitpunkt der Freischaltung. Keine Ausweiskopien oder weiteren Identitätsdaten. Die Angaben dienen
            dem Nachweis der Zustimmung (Art. 7 Abs. 1, Art. 8 Abs. 2 DSGVO) und werden mit dem Kinderkonto gelöscht.
          </li>
          <li>
            <strong>Ohne Zustimmung:</strong> Lehnt das Elternteil ab, wird ein neu angelegtes Kinderkonto sofort gelöscht. Erfolgt
            innerhalb von 14 Tagen keine Zustimmung, wird es automatisch mit allen zugehörigen Daten gelöscht. Bereits bestehende
            Konten werden nicht automatisch gelöscht, bleiben aber bis zur Zustimmung gesperrt.
          </li>
          <li>
            <strong>Schutzvoreinstellungen:</strong> Kinderkonten erscheinen nicht auf der TanzRaum Map, Spotlights sind nur für den
            eigenen Verein und Kontakte sichtbar, Nachrichten sind nur mit dem eigenen Verein und den Eltern möglich, und Kinder sind
            nur über ihren genauen Nutzernamen auffindbar. Ein verknüpftes Elternkonto kann Map und Spotlights freigeben oder
            Nachrichten abschalten.
          </li>
          <li>
            Die Zuordnung eines Kindes zu einem Elternteil durch einen Verein ersetzt die Zustimmung des Elternteils nicht.
          </li>
        </ul>
        <p>
          <strong>Rechtsgrundlagen:</strong> Die für das Kinderkonto erforderliche Verarbeitung (Konto, Verein, Nachrichten) beruht auf
          dem Nutzungsvertrag (Art. 6 Abs. 1 lit. b DSGVO), der mit Zustimmung des Elternteils geschlossen wird. Verarbeitungen, die
          auf einer Einwilligung beruhen (Push-Benachrichtigungen, Anzeige auf der Map), erfolgen bei Kindern unter 16 Jahren nur mit
          Einwilligung des Elternteils (Art. 6 Abs. 1 lit. a i. V. m. Art. 8 DSGVO). Ab 16 Jahren erteilen Nutzer erforderliche
          Einwilligungen selbst. Die Dokumentation der Zustimmung beruht auf Art. 6 Abs. 1 lit. c DSGVO i. V. m. Art. 7 Abs. 1 DSGVO.
        </p>
        <p>
          Eine Zustimmung oder Einwilligung kann jederzeit für die Zukunft widerrufen werden – über ein verknüpftes Elternkonto oder
          per E-Mail an {mail}.
        </p>
      </Abschnitt>

      <Abschnitt titel="6. Netzwerk und Karte">
        <ul>
          <li>
            Auf der Karte erscheinst du nur, wenn du das selbst einschaltest. Angezeigt werden höchstens PLZ und Ort (Mittelpunkt des
            Ortes) – niemals Straße oder Hausnummer. Kinderkonten unter 16 erscheinen nur, wenn zusätzlich ein verknüpftes Elternteil
            das erlaubt hat.
          </li>
          <li>
            Karten, Ortssuche und Kartenlinks nutzen Google Maps der Google Ireland Limited (Gordon House, Barrow Street, Dublin 4,
            Irland). Orte und Adressen rechnet unser Server über die Google Geocoding API in Koordinaten um; dabei wird nur der
            eingegebene Ort bzw. die Vereinsadresse übermittelt, nicht deine IP-Adresse.
          </li>
          <li>
            Die Karte im TanzRaum-Netzwerk lädt dein Browser erst, wenn du auf „Karte laden“ tippst (auf Wunsch für dein Gerät
            gemerkt, jederzeit abschaltbar unter der Karte). Dabei werden u. a. deine IP-Adresse und technische Gerätedaten an Google
            übertragen. Geteilte Standorte in Nachrichten und „Auf der Karte zeigen“ öffnen Google Maps erst beim Antippen.
          </li>
          <li>
            Google kann Daten auch in den USA verarbeiten. Google LLC ist unter dem EU-US Data Privacy Framework zertifiziert
            (Angemessenheitsbeschluss, Art. 45 DSGVO). Datenschutzhinweise von Google: https://policies.google.com/privacy
          </li>
        </ul>
        <p>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Sichtbarkeit auf der Karte, Laden der Google-Karte) bzw. lit. f (Umrechnung
          von Orten in Koordinaten).
        </p>
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

      <Abschnitt titel="7a. News, Umfragen und Ankündigungen">
        <p>
          Vereine können News und Umfragen an ihre Mitglieder, einzelne Gruppen, Rollen oder die Eltern einer Gruppe senden. Dafür
          speichern wir, wer eine News oder Umfrage erhalten hat, ob und wann sie gelesen bzw. bestätigt wurde (Verfasser und
          Vereinsadmins sehen diesen Lesestatus) und die abgegebenen Stimmen. Bei anonymen Umfragen sieht niemand, wer wie
          abgestimmt hat; gespeichert wird die Stimme nur, um doppelte Abstimmungen zu verhindern. TanzRaum selbst zeigt
          Ankündigungen (z. B. Wartungsarbeiten, Neuheiten) auf dem Dashboard und speichert, ob du sie ausgeblendet bzw. bestätigt
          hast. Rechtsgrundlage: Vereinsmitgliedschaft bzw. Nutzungsvertrag (Art. 6 Abs. 1 lit. b DSGVO); für Vereinsdaten ist der
          Verein verantwortlich.
        </p>
      </Abschnitt>

      <Abschnitt titel="7b. Mitgliedsanträge von Vereinen">
        <p>
          Vereine können den Beitritt über einen digitalen Mitgliedsantrag abwickeln, dessen Inhalt der Verein selbst festlegt. Die
          eingegebenen Angaben (z. B. Name, Anschrift, Geburtsdatum, Kontaktdaten, gewählte Gruppen, ggf. Bankverbindung für das
          SEPA-Lastschriftmandat und die Entscheidung zur Foto-Einwilligung), die Unterschriften mit Zeitpunkt bzw. hochgeladene
          unterschriebene Anträge und der Formularstand zum Zeitpunkt der Einreichung werden gespeichert und – je nach
          Vereinseinstellung – als PDF an die E-Mail-Adresse des Vereins (und als Kopie an dich) gesendet. Einsehen können sie nur
          du, verknüpfte Eltern sowie Vereinsadmins bzw. vom Verein berechtigte Personen – nicht die TanzRaum-Administration.
          Verantwortlich für diese Daten ist der jeweilige Verein; TanzRaum stellt die Technik bereit. Rechtsgrundlage:
          Beitritt zum Verein (Art. 6 Abs. 1 lit. b DSGVO) bzw. deine Einwilligung (Foto-Einwilligung, Art. 6 Abs. 1 lit. a DSGVO).
        </p>
      </Abschnitt>

      <Abschnitt titel="7c. Fernwartung und Plattform-Statistik">
        <p>
          Vereinsadmins können den TanzRaum-Support um Hilfe bitten und dabei einen Fernzugriff für 24 Stunden freigeben. Während dieser
          Zeit kann der Support ausschließlich Einstellungen des Vereins ändern (Vereinsdaten, Bereiche, Mitgliedsantrag-Formular) – nicht
          Mitglieder, Anträge, Chats oder persönliche Daten. Jede Änderung wird mit Zeitpunkt protokolliert; der Verein sieht das
          Protokoll und kann den Zugriff jederzeit widerrufen. Für den Betrieb wertet die TanzRaum-Administration nur zusammengefasste
          Zahlen aus (z. B. Anzahl Nutzer, Vereine, Nachrichten pro Woche) – ohne Namen und ohne Inhalte. Rechtsgrundlage: Art. 6 Abs. 1
          lit. b und f DSGVO (Vertragserfüllung bzw. berechtigtes Interesse an einem sicheren, funktionierenden Betrieb).
        </p>
      </Abschnitt>

      <Abschnitt titel="7d. TanzRaum Börse">
        <p>
          Für die Börse verarbeiten wir die Angaben deiner Angebote (Titel, Beschreibung, Preis, Zustand, Größe, Ort als Ortsname und auf
          etwa 1 km gerundete Ortsmitte für die Umkreissuche, Bilder), deine Favoriten, Meldungen und die Verknüpfung zwischen Angebot und
          Chat-Kontakt. Angebote sind für angemeldete Nutzerinnen und Nutzer sichtbar; Bilder werden nicht öffentlich abgelegt und nur über
          kurzlebige Links angezeigt. Bei gemeldeten Angeboten sieht die TanzRaum-Administration nur das Angebot, die Meldegründe und den
          Namen der anbietenden Person – nicht, wer gemeldet hat, und keine Chats. Beim Löschen eines Angebots werden Angaben und Bilder
          gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag) bzw. lit. f (Missbrauchsschutz).
        </p>
      </Abschnitt>

      <Abschnitt titel="7e. Vereinsbereiche: Musik, Kostüme, Finanzen, Fahrgemeinschaften">
        <ul>
          <li>
            <strong>Musik:</strong> hochgeladene Musikdateien mit Titel, Interpret, Verwendung und zugeordneten Gruppen. Dateien liegen in
            einem nicht öffentlichen Speicher und sind nur über kurzlebige Links abspielbar – Vereinsmusik für Vereinsadmin, Trainer und die
            Mitglieder der zugeordneten Gruppen (sowie deren Eltern), eigene Musik nur für dich.
          </li>
          <li>
            <strong>Kostüme &amp; Requisiten:</strong> welches Teil (mit Größe) wann an wen ausgegeben wurde, Rückgabedatum und Zustand bei
            Rückgabe. Sichtbar für die vom Verein berechtigten Personen und für dich bzw. verknüpfte Eltern (eigene Teile).
          </li>
          <li>
            <strong>Finanzen:</strong> Beiträge je Mitglied (Beitragsart, Betrag, Fälligkeit, bezahlt am, Zahlungsweg, Erinnerungen) sowie
            das Kassenbuch des Vereins mit Belegen. Einsehen können sie nur Vereinsadmin und vom Verein berechtigte Rollen; du bzw.
            verknüpfte Eltern sehen die eigenen Beiträge. Bankverbindungen werden hier nicht gespeichert.
          </li>
          <li>
            <strong>Fahrgemeinschaften:</strong> angebotene und gesuchte Fahrten (Anlass, Ziel, Datum, Plätze, Treffpunkt) und die Antworten
            darauf – nur innerhalb des eigenen Vereins sichtbar.
          </li>
        </ul>
        <p>
          Verantwortlich für diese Vereinsdaten ist der jeweilige Verein; TanzRaum stellt die Technik bereit. Die TanzRaum-Administration hat
          keinen Zugriff auf diese Inhalte. Rechtsgrundlage: Vereinsmitgliedschaft bzw. Nutzungsvertrag (Art. 6 Abs. 1 lit. b DSGVO); für
          Kassenbuch und Belege zusätzlich die gesetzlichen Pflichten des Vereins (Art. 6 Abs. 1 lit. c DSGVO).
        </p>
      </Abschnitt>

      <Abschnitt titel="7f. Spotlight (Stories)">
        <p>
          Mit Spotlight teilst du Stories, die 24 Stunden sichtbar sind. Erstellen können sie Nutzerinnen und Nutzer mit BASIC oder
          Vereinslizenz, ansehen alle angemeldeten Nutzerinnen und Nutzer, für die Spotlight freigeschaltet ist.
        </p>
        <ul>
          <li>
            <strong>Was wir speichern:</strong> dein Foto oder Video bzw. den gewählten Hintergrund, die Elemente deiner Story (Texte,
            Hashtags, TanzRaum-Smileys, Emojis, Zeichnungen, Ortsname, erwähnte Personen), die Sichtbarkeit und den Zeitpunkt. Videos
            werden vor dem Hochladen auf deinem Gerät verkleinert. Fotos und Videos liegen in einem nicht öffentlichen Speicher und
            werden nur über kurzlebige Links angezeigt.
          </li>
          <li>
            <strong>Wer sie sieht:</strong> Du wählst „Alle im TanzRaum-Netzwerk“ (angemeldete Nutzerinnen und Nutzer) oder „Nur mein
            Verein &amp; meine Buddys“. Stories von Konten unter 16 Jahren sind nur für den eigenen Verein und Kontakte sichtbar,
            solange ein verknüpftes Elternteil nichts anderes festlegt. Stories sind nicht öffentlich im Internet abrufbar.
          </li>
          <li>
            <strong>Ansichten und Reaktionen:</strong> Wir speichern, wer eine Story angesehen hat, damit neue Stories markiert werden
            können. Du siehst bei deinen eigenen Stories nur die Anzahl der Ansichten (ohne Namen) und die Reaktionen mit dem Namen
            der reagierenden Person.
          </li>
          <li>
            <strong>Standort:</strong> Veröffentlicht wird nur der Ortsname, den du auswählst oder selbst einträgst – keine Adresse,
            keine Koordinaten. Nutzt du „Aktuellen Standort verwenden“, ermittelt dein Gerät nach deiner Erlaubnis die Position; die
            Koordinaten werden einmalig an unseren Server übermittelt, der daraus über die Google Geocoding API den Ortsnamen
            ermittelt (siehe Abschnitt 6). Die Koordinaten werden nicht gespeichert. Die Ortssuche läuft ebenfalls über diesen
            Dienst.
          </li>
          <li>
            <strong>@Erwähnungen:</strong> Erwähnen kannst du nur Personen, denen du auch schreiben darfst. Ihr Name wird von unserem
            Server eingesetzt und ist für alle sichtbar, die die Story sehen. Die erwähnte Person wird benachrichtigt, wenn sie die
            Story sehen kann. Möchtest du nicht erwähnt werden, kannst du die Story melden.
          </li>
          <li>
            <strong>Musik:</strong> Du kannst einen Ausschnitt eines Titels aus der TanzRaum-Musik hinzufügen, den du selbst hören
            darfst. Wer die Story sieht, hört diesen Ausschnitt und sieht Titel und Interpret.
          </li>
          <li>
            <strong>Meldungen:</strong> Gemeldete Stories sieht die TanzRaum-Administration zur Prüfung.
          </li>
        </ul>
        <p>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag); Prüfung von Meldungen und Missbrauchsschutz: Art. 6 Abs. 1
          lit. f DSGVO.
        </p>
      </Abschnitt>

      <Abschnitt titel="8. Push-Benachrichtigungen">
        <p>
          Wenn du Benachrichtigungen erlaubst, speichern wir die Push-Adresse deines Browsers. Die Benachrichtigung wird über den
          Push-Dienst deines Browser-Herstellers zugestellt (z. B. Google, Apple, Mozilla, Microsoft). Die Push-Nachricht selbst
          enthält keinen Inhalt – dein Gerät holt Titel und Vorschau danach direkt bei TanzRaum ab. Du kannst Push jederzeit in
          den Einstellungen (auf diesem Gerät bzw. je Kategorie, z. B. Chat oder Anrufe) oder in den Browser-Einstellungen abschalten. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO; bei Kinderkonten unter 16 nur mit
          Einwilligung eines Elternteils (Art. 8 DSGVO).
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
          Kostenpflichtige Tarife (BASIC, VEREIN) bezahlst du über Stripe (Stripe Payments Europe, Ltd., Irland; BASIC per Karte
          oder SEPA-Lastschrift, die Vereinslizenz per SEPA-Lastschrift) oder PayPal (PayPal (Europe) S.à r.l. et Cie, S.C.A.,
          Luxemburg). Nutzt du bei Stripe Apple Pay oder Google Pay, gelten zusätzlich die Datenschutzbestimmungen von Apple bzw.
          Google, mit denen du diese Dienste vereinbart hast. Deine Zahlungsdaten gibst du direkt beim jeweiligen Anbieter ein; TanzRaum erhält keine Karten- oder Kontodaten, sondern nur die Lizenz- bzw. Zahlungskennung, den Zahlungsstatus,
          die Laufzeit und die Kunden-Kennung des Anbieters. Bei Zahlung per Banküberweisung verarbeiten wir die Angaben aus dem
          Zahlungseingang (Name, IBAN, Betrag, Verwendungszweck), um die Zahlung zuzuordnen. Für Rechnungen speichern wir Name, Tarif,
          Betrag und Zahlungsweg.
        </p>
        <p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b und c DSGVO (Vertrag, steuerliche Aufbewahrungspflichten).</p>
      </Abschnitt>

      <Abschnitt titel="11. Cookies und lokaler Speicher">
        <p>
          TanzRaum setzt nur technisch notwendige Cookies für die Anmeldung. Im lokalen Speicher deines Browsers merken wir uns
          Bedienvorlieben (z. B. zuletzt genutzte Smileys). Es gibt keine Werbe- oder Analyse-Tracker. Schriftarten werden von TanzRaum
          selbst ausgeliefert.
        </p>
      </Abschnitt>

      <Abschnitt titel="12. Externe Links">
        <p>
          Links zu Google Maps oder Google Kalender öffnen die Seiten des jeweiligen Anbieters erst, wenn du sie anklickst. Dann gilt
          dessen Datenschutzerklärung.
        </p>
      </Abschnitt>

      <Abschnitt titel="13. Speicherdauer">
        <p>Wir speichern Daten, solange dein Konto besteht oder es für den jeweiligen Zweck nötig ist:</p>
        <ul>
          <li>Konto-, Profil- und Nachrichtendaten: bis zur Löschung deines Kontos (bzw. bis du einzelne Inhalte löschst).</li>
          <li>Vereinsdaten: solange der Verein sie benötigt bzw. bis der Verein sie entfernt.</li>
          <li>Rechnungen: 10 Jahre ab Ende des Rechnungsjahres (§ 147 Abgabenordnung), in dieser Zeit unverändert. Danach werden die Empfängerangaben automatisch anonymisiert, sofern keine andere gesetzliche Aufbewahrungspflicht besteht. Rechnungen bleiben auch nach einer Kontolöschung bis zum Fristende erhalten.</li>
          <li>E-Mail-Versandprotokolle: 90 Tage.</li>
          <li>Börse-Angebote, Favoriten und eigene Musik: bis du sie löschst bzw. bis zur Löschung deines Kontos.</li>
          <li>Fahrgemeinschaften: automatisch 30 Tage nach dem Fahrtdatum.</li>
          <li>
            Spotlights: Story, Foto bzw. Video, Ansichten und Reaktionen werden 24 Stunden nach der Veröffentlichung automatisch
            gelöscht, früher, wenn du sie selbst löschst. Gemeldete Stories bleiben bis zum Abschluss der Prüfung erhalten.
          </li>
          <li>
            Kassenbuch, Belege und Beiträge: solange der Verein sie benötigt; die gesetzlichen Aufbewahrungsfristen (z. B. 10 Jahre für
            Buchungsbelege) beachtet der Verein.
          </li>
          <li>Nicht bestätigte neue Kinderkonten: 14 Tage ab Registrierung, danach automatische Löschung.</li>
          <li>Nachweis der Elternzustimmung: solange das Kinderkonto besteht.</li>
          <li>
            Nachweise deiner Einwilligungen (z. B. Nutzungsbedingungen, Push, Map – jeweils mit Zeitpunkt und Fassung des Textes):
            solange dein Konto besteht.
          </li>
          <li>
            Kontolöschung: Nach dem Antrag ist dein Konto sofort gesperrt und wird nach 14 Tagen endgültig gelöscht (bis dahin
            widerrufbar). Chatnachrichten, die du anderen geschickt hast, bleiben in deren Verläufen erhalten; der Absender wird als
            „Gelöschtes Konto“ angezeigt. Solange du Mitglied eines Vereins bist, ist die Löschung erst nach Austritt möglich – die
            Vereinsdaten verantwortet der Verein.
          </li>
        </ul>
      </Abschnitt>

      <Abschnitt titel="14. Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch
          (Art. 15–21 DSGVO). Erteilte Einwilligungen kannst du jederzeit für die Zukunft widerrufen. Einen Export deiner Daten
          (JSON) und die Löschung deines Kontos findest du selbst unter Einstellungen → Datenschutz. Für alle weiteren Anliegen schreib
          uns an {mail}.
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
