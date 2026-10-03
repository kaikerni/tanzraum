import type { SupabaseClient } from "@supabase/supabase-js";

// Inhalte der Vereinsstatistik (DB: vereine.statistik_inhalte, verein_statistik)
export const STATISTIK_INHALTE = [
  { id: "mitglieder", label: "Mitgliederentwicklung" },
  { id: "rollen", label: "Mitglieder nach Rolle" },
  { id: "altersklassen", label: "Altersklassen" },
  { id: "gruppen", label: "Tanzgruppen" },
  { id: "beteiligung", label: "Trainingsbeteiligung" },
  { id: "turniere", label: "Turnierergebnisse" },
] as const;

export type VereinStatistik = {
  inhalte: string[];
  mitglieder?: { aktiv: number; neu: number; verlauf: { monat: string; gesamt: number }[] };
  rollen?: { rolle: string; anzahl: number }[];
  altersklassen?: { altersklasse: string; anzahl: number }[];
  gruppen?: { gruppe: string; anzahl: number }[];
  beteiligung?: { monat: string; prozent: number | null }[];
  turniere?: { starts: number; podest: number; siege: number };
};

export async function getVereinStatistik(supabase: SupabaseClient, vereinId: string): Promise<{ daten: VereinStatistik | null; fehler: string | null }> {
  const { data, error } = await supabase.rpc("verein_statistik", { p_verein_id: vereinId });
  if (error) return { daten: null, fehler: error.code === "P0001" || error.code === "42501" ? error.message : "Die Statistik konnte nicht geladen werden." };
  return { daten: data as VereinStatistik, fehler: null };
}
