import type { SupabaseClient } from "@supabase/supabase-js";

export type JuryRolle = "mitglied" | "admin";

export type JuryKontext = {
  rolle: JuryRolle;
  verbandId: string | null;
  verbandName: string | null;
};

/**
 * Liefert null, wenn der Nutzer kein aktives JuryRaum-Mitglied ist -- das ist der
 * Zugriffs-Check fuer den gesamten /juryraum-Bereich (siehe app/juryraum/layout.tsx).
 */
export async function getJuryKontext(
  supabase: SupabaseClient,
  userId: string,
): Promise<JuryKontext | null> {
  const { data } = await supabase
    .from("juryraum_mitglieder")
    .select("rolle, verband_id, verbaende(name)")
    .eq("user_id", userId)
    .eq("aktiv", true)
    .maybeSingle();

  if (!data) return null;

  // deno-lint-ignore no-explicit-any
  const verband = (data as any).verbaende;
  return {
    rolle: data.rolle as JuryRolle,
    verbandId: data.verband_id,
    verbandName: verband?.name ?? null,
  };
}
