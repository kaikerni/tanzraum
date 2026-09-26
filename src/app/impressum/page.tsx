import { RechtsSeite, Abschnitt, Todo } from "@/components/recht/RechtsSeite";

export const metadata = { title: "Impressum" };

export default function ImpressumSeite() {
  return (
    <RechtsSeite titel="Impressum">
      <Abschnitt titel="Angaben gemäß § 5 DDG">
        <p>
          <Todo>Name bzw. Firma des Anbieters (bei Firmen mit Rechtsform)</Todo>
          <br />
          <Todo>Straße und Hausnummer (ladungsfähige Anschrift, kein Postfach)</Todo>
          <br />
          <Todo>PLZ und Ort</Todo>
        </p>
        <p>
          Vertreten durch: <Todo>vertretungsberechtigte Person(en), falls Firma oder Verein</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <p>
          E-Mail: <a href="mailto:info@tanzraum.app" className="text-brand-red underline">info@tanzraum.app</a>
          <br />
          Telefon: <Todo>Telefonnummer oder ein anderer schneller elektronischer Kontaktweg</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="Register und Umsatzsteuer">
        <p>
          <Todo>Registergericht und Registernummer – nur falls ein Eintrag (z. B. Handels- oder Vereinsregister) besteht</Todo>
        </p>
        <p>
          <Todo>Umsatzsteuer-Identifikationsnummer nach § 27a UStG – nur falls vorhanden</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>
          <Todo>Name und Anschrift der verantwortlichen Person</Todo>
        </p>
      </Abschnitt>

      <Abschnitt titel="Verbraucherstreitbeilegung">
        <p>
          <Todo>
            Angabe prüfen lassen, ob und wie über die Teilnahme an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            informiert werden muss (§§ 36, 37 VSBG)
          </Todo>
        </p>
      </Abschnitt>
    </RechtsSeite>
  );
}
