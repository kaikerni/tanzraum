import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bereich } from "@/lib/navigation";

const ALLE_BEREICHE: Bereich[] = [
  "verein",
  "kalender",
  "training",
  "turniere",
  "mitglieder",
  "trainer_netzwerk",
  "nachrichten",
  "dateien",
  "fahrgemeinschaften",
  "musik",
  "finanzen",
  "statistiken",
  "vereinsverwaltung",
  "training_verwalten",
  "mitglieder_verwalten",
  "dateien_hochladen",
  "musik_verwalten",
  "vereinsdaten_verwalten",
];

/**
 * Bereiche des eingeloggten Nutzers ueber alle seine Vereine (Rollen-Standard + vereins_bereichsrechte).
 * Nur fuer die Anzeige -- die eigentliche Absicherung passiert in RLS bzw. den dashboard_*-Funktionen.
 */
export async function getMeineBereiche(
  supabase: SupabaseClient,
  istPlattformAdmin: boolean,
): Promise<Set<string>> {
  if (istPlattformAdmin) return new Set(ALLE_BEREICHE);
  const { data, error } = await supabase.rpc("meine_bereiche");
  if (error || !data) return new Set();
  return new Set((data as { bereich: string }[]).map((r) => r.bereich));
}
