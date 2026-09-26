import { RechtsSeite, Abschnitt } from "@/components/recht/RechtsSeite";

export const metadata = { title: "Impressum" };

export default function ImpressumSeite() {
  return (
    <RechtsSeite titel="Impressum">
      <Abschnitt titel="Angaben gemäß § 5 DDG">
        <p>
          Kai Kern
          <br />
          Taktmanufaktur
          <br />
          Jahnstraße 15
          <br />
          67378 Zeiskam
        </p>
        <p>TanzRaum ist ein Projekt der Taktmanufaktur.</p>
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <p>
          Telefon: <a href="tel:+4917655101261" className="text-brand-red underline">0176 55101261</a>
          <br />
          E-Mail: <a href="mailto:info@tanzraum.app" className="text-brand-red underline">info@tanzraum.app</a>
        </p>
      </Abschnitt>

      <Abschnitt titel="Umsatzsteuer">
        <p>Kleinunternehmer im Sinne von § 19 UStG – es wird keine Umsatzsteuer berechnet und ausgewiesen.</p>
      </Abschnitt>

      <Abschnitt titel="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>Kai Kern, Jahnstraße 15, 67378 Zeiskam</p>
      </Abschnitt>

      <Abschnitt titel="Verbraucherstreitbeilegung">
        <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </Abschnitt>
    </RechtsSeite>
  );
}
