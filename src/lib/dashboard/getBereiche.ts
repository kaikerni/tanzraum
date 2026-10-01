import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tarif, Zugriff } from "@/lib/navigation";

/**
 * Effektiver Tarif + Bereiche/Rollenmarker des eingeloggten Nutzers (DB: mein_tarif, meine_bereiche).
 * Nur fuer die Anzeige -- abgesichert wird ueber RLS bzw. die dashboard_*-Funktionen.
 */
export async function getZugriff(supabase: SupabaseClient, istPlattformAdmin: boolean): Promise<Zugriff> {
  const [{ data: musik }, { data: spotlights }, { data: jury }, { data: navi }] = await Promise.all([
    supabase.rpc("musik_freigegeben"),
    supabase.rpc("spotlights_fuer_mich"),
    supabase.rpc("juryraum_fuer_mich"),
    supabase.rpc("meine_navigation"),
  ]);
  // Persoenliche Reihenfolge – nur Anzeige, die Rechte oben bleiben unberuehrt
  const reihenfolge = Array.isArray(navi) ? (navi as string[]).filter((x) => typeof x === "string") : null;
  const musikAn = musik === true;
  const spotlightsAn = spotlights === true;
  const juryraum = jury === true;
  if (istPlattformAdmin) return { tarif: "verein", bereiche: [], istPlattformAdmin: true, netzwerk: "trainer", musikAn, spotlightsAn, juryraum, reihenfolge };

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
    spotlightsAn,
    juryraum,
    reihenfolge,
  };
}
