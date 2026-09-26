import { DruckFuss, DruckKopf } from "@/components/ehrungen/DruckKopf";
import { KeinZugriff } from "@/components/ehrungen/EhrungenKopf";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getVorgaenge, mengen } from "@/lib/ehrungen/daten";
import { MONATE, STATUS, TYP, datum, grundKurz, jahresEintraege, stichtagVon } from "@/lib/ehrungen/typen";

export const metadata = { title: "Jahresübersicht – Ehrungen – TanzRaum" };

export default async function DruckUebersicht({ searchParams }: { searchParams: Promise<{ verein?: string; jahr?: string }> }) {
  const sp = await searchParams;
  const { supabase, verein, ohneLizenz } = await ehrungsKontext(sp.verein);
  if (!verein || (sp.verein && verein.vereinId !== sp.verein)) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const jahr = /^\d{4}$/.test(sp.jahr ?? "") ? Number(sp.jahr) : new Date().getFullYear();
  const liste = jahresEintraege(await getVorgaenge(supabase, verein.vereinId), jahr);
  return (
    <>
      <DruckKopf verein={verein.vereinName} titel={`Ehrungen ${jahr}`} untertitel={`${liste.length} Ehrung${liste.length === 1 ? "" : "en"} – wer bekommt was, wann und warum`} />
      <table className="druck-tabelle mb-6">
        <thead>
          <tr>
            {MONATE.map((m) => (
              <th key={m} style={{ textAlign: "center" }}>
                {m.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {MONATE.map((m, i) => (
              <td key={m} style={{ textAlign: "center", fontWeight: 700 }}>
                {liste.filter((v) => Number(stichtagVon(v)!.slice(5, 7)) === i + 1).length}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <table className="druck-tabelle mb-6">
        <thead>
          <tr>
            <th>Termin</th>
            <th>Mitglied</th>
            <th>Auszeichnung</th>
            <th>Verband</th>
            <th>Grund</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((v) => (
            <tr key={v.id}>
              <td>{datum(stichtagVon(v))}</td>
              <td>{v.personName}</td>
              <td>
                {TYP[v.typ].zeichen} {v.auszeichnung}
              </td>
              <td>{v.organisation ?? "vereinsintern"}</td>
              <td>{grundKurz(v)}</td>
              <td>{STATUS[v.status].label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mb-2 text-[15px] font-bold">Mengen im Jahr {jahr}</h2>
      <table className="druck-tabelle">
        <thead>
          <tr>
            <th>Auszeichnung</th>
            <th>Verband / Organisation</th>
            <th style={{ width: 70 }}>Anzahl</th>
          </tr>
        </thead>
        <tbody>
          {mengen(liste).map((m) => (
            <tr key={m.auszeichnung + m.organisation}>
              <td>{m.auszeichnung}</td>
              <td>{m.organisation ?? "vereinsintern"}</td>
              <td>{m.anzahl}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <DruckFuss />
    </>
  );
}
