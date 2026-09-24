import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tarif, Zugriff } from "@/lib/navigation";

/**
 * Effektiver Tarif + Bereiche/Rollenmarker des eingeloggten Nutzers (DB: mein_tarif, meine_bereiche).
 * Nur fuer die Anzeige -- abgesichert wird ueber RLS bzw. die dashboard_*-Funktionen.
 */
export async function getZugriff(supabase: SupabaseClient, istPlattformAdmin: boolean): Promise<Zugriff> {
  if (istPlattformAdmin) return { tarif: "verein", bereiche: [], istPlattformAdmin: true };

  const [{ data: tarif }, { data: bereiche }] = await Promise.all([
    supabase.rpc("mein_tarif"),
    supabase.rpc("meine_bereiche"),
  ]);

  return {
    tarif: tarif === "basic" || tarif === "verein" ? (tarif as Tarif) : "free",
    bereiche: [...new Set(((bereiche ?? []) as { bereich: string }[]).map((r) => r.bereich))],
    istPlattformAdmin: false,
  };
}
