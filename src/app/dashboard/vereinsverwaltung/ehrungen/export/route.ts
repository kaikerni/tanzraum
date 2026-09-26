import { createClient } from "@/lib/supabase/server";
import { getBestellung, getVorgaenge, mengen } from "@/lib/ehrungen/daten";
import { HERKUNFT, STATUS, TYP, grundKurz, jahresEintraege, stichtagVon, type Vorgang } from "@/lib/ehrungen/typen";

// CSV-Export (Semikolon, UTF-8 mit BOM – oeffnet sich direkt in Excel). Daten nur ueber RLS (Vereinsadmins).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function zelle(w: unknown): string {
  let s = w === null || w === undefined ? "" : String(w);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // keine Formeln in Tabellenprogrammen
  return `"${s.replace(/"/g, '""')}"`;
}
function datumDe(w: string | null): string {
  return w ? `${w.slice(8, 10)}.${w.slice(5, 7)}.${w.slice(0, 4)}` : "";
}
const KOPF = ["Mitglied", "Auszeichnung", "Art", "Verband/Organisation", "Grund", "Termin", "Voraussichtlich", "Gewünscht", "Status", "Herkunft", "Bestellt am", "Erhalten am", "Verliehen am", "Bemerkung"];
function zeile(v: Vorgang): unknown[] {
  return [
    v.personName,
    v.auszeichnung,
    TYP[v.typ].kurz,
    v.organisation ?? "",
    grundKurz(v),
    datumDe(stichtagVon(v)),
    datumDe(v.faelligAm),
    datumDe(v.wunschDatum),
    STATUS[v.status].label,
    HERKUNFT[v.herkunft].label,
    datumDe(v.bestelltAm),
    datumDe(v.erhaltenAm),
    datumDe(v.verliehenAm),
    v.begruendung ?? "",
  ];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const art = url.searchParams.get("art");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });

  let zeilen: unknown[][] = [];
  let name = "ehrungen";
  if (art === "bestellung") {
    const id = url.searchParams.get("id") ?? "";
    if (!UUID.test(id)) return new Response("Ungültig", { status: 400 });
    const b = await getBestellung(supabase, id);
    if (!b) return new Response("Nicht gefunden", { status: 404 });
    const liste = (await getVorgaenge(supabase, b.vereinId)).filter((v) => v.bestellungId === id);
    zeilen = [[`Bestellung: ${b.bezeichnung}`], [], ["Auszeichnung", "Verband/Organisation", "Art", "Anzahl"]];
    for (const m of mengen(liste)) zeilen.push([m.auszeichnung, m.organisation ?? "", TYP[m.typ].kurz, m.anzahl]);
    zeilen.push([], KOPF, ...liste.map(zeile));
    name = `ehrungen-bestellung-${b.bezeichnung.replace(/[^\wäöüÄÖÜß-]+/g, "-").slice(0, 40)}`;
  } else {
    const vereinId = url.searchParams.get("verein") ?? "";
    if (!UUID.test(vereinId)) return new Response("Ungültig", { status: 400 });
    const alle = await getVorgaenge(supabase, vereinId);
    if (art === "jahr") {
      const jahr = Number(url.searchParams.get("jahr"));
      if (!Number.isInteger(jahr)) return new Response("Ungültig", { status: 400 });
      zeilen = [KOPF, ...jahresEintraege(alle, jahr).map(zeile)];
      name = `ehrungen-${jahr}`;
    } else {
      zeilen = [KOPF, ...alle.map(zeile)];
    }
  }
  const csv = "﻿" + zeilen.map((z) => z.map(zelle).join(";")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
