import type { SupabaseClient } from "@supabase/supabase-js";
import type { NetzwerkModus } from "@/lib/navigation";

export type NetzwerkStatus = "keine" | "ausstehend" | "eingehend" | "verbunden" | "abgelehnt";

export type NetzwerkTreffer = {
  userId: string;
  anzeige: string;
  handle: string | null;
  avatarUrl: string | null;
  vereine: string | null;
  status: NetzwerkStatus;
};

export type NetzwerkKontakt = NetzwerkTreffer & { seit: string | null; gespraechId: string | null };

export type NetzwerkProfil = {
  userId: string;
  anzeige: string;
  handle: string | null;
  avatarUrl: string | null;
  status: NetzwerkStatus;
  verbundenSeit: string | null;
  vereine: {
    verein: string;
    ort: string | null;
    rolle: string | null;
    gruppen: { name: string | null; altersklasse: string | null; disziplin: string | null }[];
  }[];
};

export const NETZWERK_TITEL: Record<NetzwerkModus, string> = { trainer: "Trainer-Netzwerk", tanzraum: "TanzRaum-Netzwerk" };

export async function getNetzwerkModus(supabase: SupabaseClient): Promise<NetzwerkModus | null> {
  const { data } = await supabase.rpc("netzwerk_modus");
  return data === "trainer" || data === "tanzraum" ? data : null;
}

// deno-lint-ignore no-explicit-any
function alsTreffer(t: any): NetzwerkTreffer {
  return {
    userId: t.user_id,
    anzeige: t.anzeige ?? (t.handle ? `@${t.handle}` : "TanzRaum-Mitglied"),
    handle: t.handle,
    avatarUrl: t.avatar_url,
    vereine: t.vereine,
    status: t.status,
  };
}

export async function netzwerkSuche(supabase: SupabaseClient, suche: string): Promise<NetzwerkTreffer[]> {
  const { data } = await supabase.rpc("netzwerk_suchen", { p_suche: suche });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map(alsTreffer);
}

export async function getNetzwerkKontakte(supabase: SupabaseClient): Promise<NetzwerkKontakt[]> {
  const { data } = await supabase.rpc("meine_netzwerk_kontakte");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((k) => ({ ...alsTreffer(k), seit: k.seit, gespraechId: k.gespraech_id }));
}

export async function getNetzwerkProfil(supabase: SupabaseClient, userId: string): Promise<NetzwerkProfil | null> {
  const { data } = await supabase.rpc("netzwerk_profil", { p_user_id: userId }).maybeSingle();
  if (!data) return null;
  // deno-lint-ignore no-explicit-any
  const p = data as any;
  return { ...alsTreffer(p), verbundenSeit: p.verbunden_seit, vereine: p.vereine ?? [] };
}
