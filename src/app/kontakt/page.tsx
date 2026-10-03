import Link from "next/link";
import { RechtsSeite, Abschnitt, AnbieterNichtVerfuegbar } from "@/components/recht/RechtsSeite";
import { getAnbieter, telefonLink } from "@/lib/recht/anbieter";

export const metadata = { title: "Kontakt" };
export const dynamic = "force-dynamic";

// Kein Kontaktformular (kein Mail-Relay): Kontakt per E-Mail/Telefon an die zentral hinterlegte Anbieteradresse
export default async function KontaktSeite() {
  const a = await getAnbieter();
  if (!a) {
    return (
      <RechtsSeite titel="Kontakt" stand={null}>
        <AnbieterNichtVerfuegbar />
      </RechtsSeite>
    );
  }
  const mail = (
    <a href={`mailto:${a.email}`} className="font-semibold text-brand-red underline">
      {a.email}
    </a>
  );
  return (
    <RechtsSeite titel="Kontakt" stand={null}>
      <Abschnitt titel="TanzRaum-Support">
        <p>Fragen zu TanzRaum, deinem Konto, deiner Lizenz oder einer Rechnung? Schreib uns an {mail}.</p>
        {a.telefon && (
          <p>
            Telefon:{" "}
            <a href={telefonLink(a.telefon)} className="text-brand-red underline">
              {a.telefon}
            </a>
          </p>
        )}
        <p>
          Postanschrift: {a.name}
          {a.unternehmen ? `, ${a.unternehmen}` : ""}, {a.strasse}, {a.plz} {a.ort}
        </p>
      </Abschnitt>

      <Abschnitt titel="Datenschutz">
        <p>
          Auskunft, Berichtigung, Löschung oder Widerruf einer Einwilligung: {mail}. Deine Daten kannst du auch selbst unter{" "}
          <Link href="/dashboard/einstellungen#datenschutz" className="text-brand-red underline">
            Einstellungen → Datenschutz
          </Link>{" "}
          herunterladen oder dort die Löschung deines Kontos beantragen.
        </p>
        <p>
          Fragen zu den Daten, die dein Verein über dich verwaltet (z. B. Beiträge, Anwesenheit), richtest du am besten direkt an deinen
          Verein – er ist dafür verantwortlich.
        </p>
      </Abschnitt>

      <Abschnitt titel="Missbrauch melden">
        <p>
          Unangemessene Inhalte oder Nachrichten kannst du direkt in der App melden. In dringenden Fällen erreichst du uns unter {mail}.
        </p>
      </Abschnitt>
    </RechtsSeite>
  );
}
