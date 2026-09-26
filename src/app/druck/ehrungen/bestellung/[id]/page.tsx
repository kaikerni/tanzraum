import { notFound } from "next/navigation";
import { DruckFuss, DruckKopf } from "@/components/ehrungen/DruckKopf";
import { KeinZugriff } from "@/components/ehrungen/EhrungenKopf";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getBestellung, getVorgaenge, mengen } from "@/lib/ehrungen/daten";
import { STATUS, TYP, datum, grundKurz } from "@/lib/ehrungen/typen";

export const metadata = { title: "Bestellübersicht – Ehrungen – TanzRaum" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DruckBestellung({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, vereine, ohneLizenz } = await ehrungsKontext();
  const b = await getBestellung(supabase, id);
  const verein = b ? vereine.find((v) => v.vereinId === b.vereinId) : null;
  if (!b || !verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const liste = (await getVorgaenge(supabase, verein.vereinId)).filter((v) => v.bestellungId === id);
  const menge = mengen(liste);
  return (
    <>
      <DruckKopf
        verein={verein.vereinName}
        titel={`Bestellübersicht: ${b.bezeichnung}`}
        untertitel={[
          `${liste.length} Ehrung${liste.length === 1 ? "" : "en"}`,
          b.bestelltAm ? `bestellt am ${datum(b.bestelltAm)}` : "in Vorbereitung",
          b.bestellnummer ? `Bestellnummer ${b.bestellnummer}` : null,
          b.anbieter,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <h2 className="mb-2 text-[15px] font-bold">Mengenübersicht</h2>
      <table className="druck-tabelle mb-6">
        <thead>
          <tr>
            <th>Auszeichnung</th>
            <th>Verband / Organisation</th>
            <th>Art</th>
            <th style={{ width: 70 }}>Anzahl</th>
          </tr>
        </thead>
        <tbody>
          {menge.map((m) => (
            <tr key={m.auszeichnung + m.organisation}>
              <td>{m.auszeichnung}</td>
              <td>{m.organisation ?? "–"}</td>
              <td>
                {TYP[m.typ].zeichen} {TYP[m.typ].kurz}
              </td>
              <td>
                <strong>{m.anzahl} Stück</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mb-2 text-[15px] font-bold">Detailliste</h2>
      <table className="druck-tabelle">
        <thead>
          <tr>
            <th>Mitglied</th>
            <th>Auszeichnung</th>
            <th>Verband</th>
            <th>Grund</th>
            <th>Gewünscht</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((v) => (
            <tr key={v.id}>
              <td>{v.personName}</td>
              <td>{v.auszeichnung}</td>
              <td>{v.organisation ?? "vereinsintern"}</td>
              <td>{grundKurz(v)}</td>
              <td>{datum(v.wunschDatum ?? v.faelligAm)}</td>
              <td>{STATUS[v.status].label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <DruckFuss />
    </>
  );
}
