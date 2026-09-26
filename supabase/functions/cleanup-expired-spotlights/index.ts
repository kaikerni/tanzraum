// Supabase Edge Function: cleanup-expired-spotlights (stuendlich per pg_cron)
// Loescht abgelaufene bzw. entfernte Spotlights: erst die Mediendatei im privaten Bucket "spotlights",
// dann die Zeile (Ansichten/Reaktionen per ON DELETE CASCADE). Spotlights mit offener Meldung bleiben
// fuer die TanzRaum-Administration erhalten (DB-Funktion spotlights_zum_loeschen).

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKeys["default"]);

    const { data: abgelaufen, error } = await admin.rpc("spotlights_zum_loeschen");
    if (error) throw error;
    const liste = (abgelaufen ?? []) as { id: string; media_path: string | null }[];
    if (liste.length === 0) {
      return new Response(JSON.stringify({ geloescht: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    const pfade = liste.map((s) => s.media_path).filter((p): p is string => !!p);
    if (pfade.length > 0) {
      const { error: storageErr } = await admin.storage.from("spotlights").remove(pfade);
      // Eine fehlende Datei soll die Aufraeumung nicht blockieren
      if (storageErr) console.warn("[cleanup-expired-spotlights] Storage teilweise fehlgeschlagen");
    }

    const ids = liste.map((s) => s.id);
    const { error: delErr } = await admin.from("spotlights").delete().in("id", ids);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ geloescht: ids.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cleanup-expired-spotlights]", e);
    return new Response(JSON.stringify({ error: "Aufräumen fehlgeschlagen" }), { status: 500 });
  }
});
