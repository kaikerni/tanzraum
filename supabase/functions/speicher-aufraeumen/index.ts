// Supabase Edge Function: speicher-aufraeumen (verify_jwt: false)
//
//   POST {}  (pg_cron, Header x-tanzraum-geheimnis) -> entfernt verwaiste Dateien aus dem Speicher
//
// Verwaist = aelter als 2 Tage und von keiner Datenbankzeile mehr verwendet (abgebrochene Uploads,
// Reste geloeschter Eintraege). Welche Dateien das sind, entscheidet allein die Datenbank
// (verwaiste_dateien); geloescht wird ueber die Storage-API. Keine Pfade in den Logs.

import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (daten: unknown, status = 200) =>
  new Response(JSON.stringify(daten), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Service-Schluessel (neues Format SUPABASE_SECRET_KEYS, sonst Legacy)
function dienst() {
  let schluessel = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (k.default) schluessel = k.default;
  } catch {
    /* Legacy */
  }
  return createClient(Deno.env.get("SUPABASE_URL")!, schluessel, { auth: { persistSession: false } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);
  const admin = dienst();
  const geheimnis = req.headers.get("x-tanzraum-geheimnis");
  const { data: erlaubt } = await admin.rpc("interner_aufruf_ok", { p_geheimnis: geheimnis });
  if (erlaubt !== true) return json({ error: "Nicht berechtigt." }, 401);

  const { data, error } = await admin.rpc("verwaiste_dateien", { p_geheimnis: geheimnis });
  if (error) return json({ error: "Abruf fehlgeschlagen." }, 500);
  let entfernt = 0;
  let fehler = 0;
  for (const z of (data ?? []) as { bucket: string; pfade: string[] }[]) {
    const pfade = Array.isArray(z.pfade) ? z.pfade : [];
    for (let i = 0; i < pfade.length; i += 100) {
      const teil = pfade.slice(i, i + 100);
      const { error: e } = await admin.storage.from(z.bucket).remove(teil);
      if (e) fehler += teil.length;
      else entfernt += teil.length;
    }
  }
  if (entfernt || fehler) console.log(`[speicher-aufraeumen] entfernt=${entfernt} fehler=${fehler}`);
  return json({ ok: true, entfernt, fehler });
});
