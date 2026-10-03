import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tarif, Zugriff } from "@/lib/navigation";

/**
 * Effektiver Tarif + Bereiche/Rollenmarker des eingeloggten Nutzers (DB: mein_tarif, meine_bereiche).
 * Nur fuer die Anzeige -- abgesichert wird ueber RLS bzw. die dashboard_*-Funktionen.
 */
export async function getZugriff(supabase: SupabaseClient, istPlattformAdmin: boolean): Promise<Zugriff> {
  const [{ data: musik }, { data: spotlights }, { data: jury }, { data: navi }, { data: team }, { data: aus }, { data: einstellung }, { data: chat }] = await Promise.all([
    supabase.rpc("musik_freigegeben"),
    supabase.rpc("spotlights_fuer_mich"),
    supabase.rpc("juryraum_fuer_mich"),
    supabase.rpc("meine_navigation"),
    supabase.rpc("meine_team_rechte"),
    istPlattformAdmin ? supabase.rpc("meine_navigation_ausgeblendet") : Promise.resolve({ data: null }),
    supabase.from("plattform_einstellungen").select("navigation_tarife").eq("id", true).maybeSingle(),
    supabase.rpc("chat_fuer_mich"),
  ]);
  // Persoenliche Reihenfolge / ausgeblendete Admin-Punkte / Tarif-Navigation – nur Anzeige, die Rechte bleiben unberuehrt
  const reihenfolge = Array.isArray(navi) ? (navi as string[]).filter((x) => typeof x === "string") : null;
  const ausgeblendet = Array.isArray(aus) ? (aus as string[]).filter((x) => typeof x === "string") : null;
  const navTarife = navTarifeLesen((einstellung as { navigation_tarife?: unknown } | null)?.navigation_tarife);
  const musikAn = musik === true;
  const spotlightsAn = spotlights === true;
  const juryraum = jury === true;
  const chatAn = chat === true;
  const istTeam = (team as { team?: boolean } | null)?.team === true;
  if (istPlattformAdmin)
    return { tarif: "verein", bereiche: [], istPlattformAdmin: true, netzwerk: "trainer", musikAn, spotlightsAn, chatAn, juryraum, reihenfolge, ausgeblendet, team: false };

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
    chatAn,
    juryraum,
    reihenfolge,
    team: istTeam,
    navTarife,
  };
}

// {"/dashboard/workshops": ["free","basic"], …} – nur gueltige Eintraege uebernehmen
export function navTarifeLesen(wert: unknown): Record<string, string[]> | null {
  if (!wert || typeof wert !== "object" || Array.isArray(wert)) return null;
  const aus: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(wert as Record<string, unknown>)) {
    if (Array.isArray(v)) aus[k] = v.filter((t): t is string => t === "free" || t === "basic" || t === "verein");
  }
  return aus;
}
