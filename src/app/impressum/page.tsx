import { RechtsSeite, Abschnitt, AnbieterNichtVerfuegbar } from "@/components/recht/RechtsSeite";
import { getAnbieter, telefonLink } from "@/lib/recht/anbieter";

export const metadata = { title: "Impressum" };
export const dynamic = "force-dynamic";

// Alle Angaben aus der zentralen Anbieter-Konfiguration (plattform_anbieter)
export default async function ImpressumSeite() {
  const a = await getAnbieter();
  if (!a) {
    return (
      <RechtsSeite titel="Impressum" stand={null}>
        <AnbieterNichtVerfuegbar />
      </RechtsSeite>
    );
  }
  return (
    <RechtsSeite titel="Impressum" stand={null}>
      <Abschnitt titel="Angaben gemäß § 5 DDG">
        <p>
          {a.name}
          {a.unternehmen && (
            <>
              <br />
              {a.unternehmen}
            </>
          )}
          <br />
          {a.strasse}
          <br />
          {a.plz} {a.ort}
        </p>
        {a.unternehmen && <p>TanzRaum ist ein Projekt der {a.unternehmen}.</p>}
      </Abschnitt>

      <Abschnitt titel="Kontakt">
        <p>
          {a.telefon && (
            <>
              Telefon: <a href={telefonLink(a.telefon)} className="text-brand-red underline">{a.telefon}</a>
              <br />
            </>
          )}
          E-Mail: <a href={`mailto:${a.email}`} className="text-brand-red underline">{a.email}</a>
        </p>
      </Abschnitt>

      <Abschnitt titel="Umsatzsteuer">
        {a.kleinunternehmer ? (
          <p>Kleinunternehmer im Sinne von § 19 UStG – es wird keine Umsatzsteuer berechnet und ausgewiesen.</p>
        ) : a.ustId ? (
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: {a.ustId}</p>
        ) : (
          <p>Umsatzsteuer wird gemäß den gesetzlichen Vorgaben ausgewiesen.</p>
        )}
      </Abschnitt>

      {a.verantwortlichInhalt && (
        <Abschnitt titel="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <p>{a.verantwortlichInhalt}</p>
        </Abschnitt>
      )}

      <Abschnitt titel="Verbraucherstreitbeilegung">
        <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </Abschnitt>
    </RechtsSeite>
  );
}
