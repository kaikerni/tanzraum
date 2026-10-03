import type { SupabaseClient } from "@supabase/supabase-js";

export type OnlineKontakt = { id: string; name: string; avatarUrl: string | null };
export type OnlineUebersicht = {
  gesamt: number;
  verein: number;
  hatVerein: boolean;
  kontakte: OnlineKontakt[];
  ichSichtbar: boolean;
  // nur fuer die TanzRaum-Administration (aggregiert)
  aktiv24h?: number;
};

// Wer ist gerade online? Zahlen fuer alle; Namen nur von Kontakten/Vereinsmitgliedern mit Opt-in (DB: online_uebersicht)
export async function getOnline(supabase: SupabaseClient, istPlattformAdmin: boolean): Promise<OnlineUebersicht | null> {
  const [{ data }, statistik] = await Promise.all([
    supabase.rpc("online_uebersicht"),
    istPlattformAdmin ? supabase.rpc("admin_plattform_statistik") : Promise.resolve({ data: null }),
  ]);
  if (!data) return null;
  // deno-lint-ignore no-explicit-any
  const d = data as any;
  // deno-lint-ignore no-explicit-any
  const s = statistik.data as any;
  return {
    gesamt: Number(d.gesamt ?? 0),
    verein: Number(d.verein ?? 0),
    hatVerein: !!d.hat_verein,
    // deno-lint-ignore no-explicit-any
    kontakte: ((d.kontakte ?? []) as any[]).map((k) => ({ id: k.id, name: k.name ?? "TanzRaum-Mitglied", avatarUrl: k.avatar_url ?? null })),
    ichSichtbar: !!d.ich_sichtbar,
    aktiv24h: s ? Number(s.aktiv_24h ?? 0) : undefined,
  };
}
