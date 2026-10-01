import type { SupabaseClient } from "@supabase/supabase-js";
import { aktiveAnsicht } from "@/lib/admin/ansichtLesen";
import { ansichtZugriff } from "@/lib/admin/ansicht";
import { getZugriff } from "@/lib/dashboard/getBereiche";
import { NAV, NETZWERK, sichtbareNav } from "@/lib/navigation";

// Welche Netzwerk-Bereiche darf ich sehen? Gleiche Regeln wie das Menue (Tarif, Spotlight-Schalter).
// Abgesichert wird zusaetzlich in der Datenbank (netzwerk_suche, netzwerk_map, meine_buddys, Spotlights …).
export async function netzwerkZugang(supabase: SupabaseClient) {
  const { data: admin } = await supabase.rpc("ist_plattform_admin_aktuell");
  const echt = await getZugriff(supabase, admin === true);
  const ansicht = await aktiveAnsicht();
  const zugriff = ansicht ? { ...ansichtZugriff(ansicht), spotlightsAn: echt.spotlightsAn } : echt;
  // Plattform-Administration: eigenes Menue ohne Unterpunkte – im Netzwerk sieht sie alle Bereiche
  const erlaubt = (zugriff.istPlattformAdmin ? NAV.filter((n) => !n.spotlights || zugriff.spotlightsAn) : sichtbareNav(zugriff))
    .filter((n) => n.eltern === NETZWERK)
    .map((n) => n.href);
  return {
    zugriff,
    erlaubt,
    darf: (bereich: "suche" | "buddys" | "anfragen" | "spotlight" | "map" | "vereine") => erlaubt.includes(`${NETZWERK}/${bereich}`),
    voll: erlaubt.includes(`${NETZWERK}/map`),
  };
}

export const NETZWERK_BEREICHE = NAV.filter((n) => n.eltern === NETZWERK);
