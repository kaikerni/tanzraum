// Supabase Edge Function: rechnung-pdf (verify_jwt: true)
// Liefert Rechnungen als PDF: eine Rechnung (Vorschau/Download) oder mehrere als Sammel-PDF (je Rechnung eine Seite).
//
//   POST { ids: string[] }            -> diese Rechnungen (max. 500)
//   POST { alle: true, jahr?: number } -> alle Rechnungen (optional nur ein Rechnungsjahr), nur Plattform-Administration
//
// Gelesen wird ALS angemeldete Person: RLS auf rechnungen entscheidet (Plattform-Admin alle, Empfaenger/Vereinsadmin eigene).

import { CORS, appUrl, json } from "../_shared/mail.ts";
import { angemeldet, UUID } from "../_shared/zugriff.ts";
import { dateiname, rechnungLogo, rechnungPdf, type RechnungDaten } from "../_shared/rechnung-pdf.ts";

const SPALTEN =
  "nummer, rechnungsdatum, empfaenger_name, empfaenger_adresse, empfaenger_email, leistung, zeitraum, betrag, zahlungsweg, leistung_von, leistung_bis, aussteller, anonymisiert_am";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);
  const sitzung = await angemeldet(req);
  if (!sitzung) return json({ error: "Nicht berechtigt." }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  let q = sitzung.nutzer.from("rechnungen").select(SPALTEN).order("nummer").limit(500);
  if (body?.alle === true) {
    const { data: istAdmin } = await sitzung.nutzer.rpc("ist_plattform_admin_aktuell");
    if (istAdmin !== true) return json({ error: "Nicht berechtigt." }, 403);
    const jahr = Number(body?.jahr);
    if (Number.isInteger(jahr) && jahr >= 2020 && jahr <= 2100) q = q.gte("rechnungsdatum", `${jahr}-01-01`).lte("rechnungsdatum", `${jahr}-12-31`);
  } else {
    const ids: unknown = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((i) => typeof i === "string" && UUID.test(i))) {
      return json({ error: "Ungültige Rechnung." }, 400);
    }
    q = q.in("id", ids);
  }
  const { data, error } = await q;
  if (error) return json({ error: "Rechnungen konnten nicht geladen werden." }, 500);
  const liste = (data ?? []) as RechnungDaten[];
  if (liste.length === 0) return json({ error: "Keine Rechnungen gefunden." }, 404);

  const pdf = await rechnungPdf(liste, await rechnungLogo(appUrl()));
  const name = liste.length === 1 ? dateiname(liste[0].nummer) : `TanzRaum-Rechnungen${body?.jahr ? `-${Number(body.jahr)}` : ""}.pdf`;
  return new Response(pdf, {
    headers: { ...CORS, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "no-store" },
  });
});
