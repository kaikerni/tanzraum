import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kategorie, ThemaListe, TreffStatus } from "./treff";

export async function treffStatus(supabase: SupabaseClient): Promise<TreffStatus> {
  const { data } = await supabase.rpc("treff_mein_status");
  const d = (data ?? {}) as Partial<TreffStatus>;
  return {
    schreiben: d.schreiben === true,
    tarif: d.tarif ?? "free",
    unter_16: d.unter_16 === true,
    gesperrt_bis: d.gesperrt_bis ?? null,
    themen_erstellen_team: d.themen_erstellen_team === true,
    admin: d.admin === true,
    rechte: Array.isArray(d.rechte) ? d.rechte : [],
  };
}

export async function themenListe(
  supabase: SupabaseClient,
  o: { kategorie?: string | null; ansicht?: "kategorie" | "aktuell" | "neu" | "angepinnt"; q?: string | null; limit?: number; offset?: number },
): Promise<ThemaListe[]> {
  const { data } = await supabase.rpc("treff_themen_liste", {
    p_kategorie: o.kategorie ?? null,
    p_ansicht: o.ansicht ?? "kategorie",
    p_q: o.q ?? null,
    p_limit: o.limit ?? 30,
    p_offset: o.offset ?? 0,
  });
  return (data ?? []) as ThemaListe[];
}

export async function kategorienListe(supabase: SupabaseClient): Promise<Kategorie[]> {
  const { data } = await supabase.rpc("treff_kategorien_liste");
  return (data ?? []) as Kategorie[];
}
