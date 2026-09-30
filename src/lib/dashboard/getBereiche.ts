import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tarif, Zugriff } from "@/lib/navigation";

/**
 * Effektiver Tarif + Bereiche/Rollenmarker des eingeloggten Nutzers (DB: mein_tarif, meine_bereiche).
 * Nur fuer die Anzeige -- abgesichert wird ueber RLS bzw. die dashboard_*-Funktionen.
 */
export async function getZugriff(supabase: SupabaseClient, istPlattformAdmin: boolean): Promise<Zugriff> {
  const { data: musik } = await supabase.rpc("musik_freigegeben");
  const musikAn = musik === true;
  if (istPlattformAdmin) return { tarif: "verein", bereiche: [], istPlattformAdmin: true, netzwerk: "trainer", musikAn };

  const [{ data: tarif }, { data: bereiche }, { data: netzwerk }, { data: moduleAus }] = await Promise.all([
    supabase.rpc("mein_tarif"),
    supabase.rpc("meine_bereiche"),
    supabase.rpc("netzwerk_modus"),
    supabase.rpc("meine_module_aus"),
  ]);

  return {
    tarif: tarif === "basic" || tarif === "verein" ? (tarif as Tarif) : "free",
    bereiche: [...new Set(((bereiche ?? []) as { bereich: string }[]).map((r) => r.bereich))],
    moduleAus: Array.isArray(moduleAus) ? (moduleAus as string[]) : [],
    istPlattformAdmin: false,
    netzwerk: netzwerk === "trainer" || netzwerk === "tanzraum" ? netzwerk : null,
    musikAn,
  };
}
