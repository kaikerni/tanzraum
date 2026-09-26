import type { SupabaseClient } from "@supabase/supabase-js";

export type Kind = {
  kindId: string;
  anzeige: string;
  verknuepfungId: string | null;
  status: "bestaetigt" | "wartet_verein";
  // "code" = selbst verknuepft, "verein" = vom Verein zugeordnet (dort verwaltet)
  quelle: "code" | "verein";
  unter16: boolean;
  nachrichtenErlaubt: boolean;
  mapErlaubt: boolean;
  spotlightsNurKontakte: boolean;
  pushErlaubt: boolean;
};

export type Elternteil = { verknuepfungId: string; elternId: string; anzeige: string; status: "bestaetigt" | "wartet_verein" };

export type MeineSchutzEinstellungen = {
  hatEltern: boolean;
  unter16: boolean;
  nachrichtenErlaubt: boolean;
  mapErlaubt: boolean;
  spotlightsNurKontakte: boolean;
  pushErlaubt: boolean;
};

export async function getMeineKinder(supabase: SupabaseClient): Promise<Kind[]> {
  const { data } = await supabase.rpc("meine_kinder");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((k) => ({
    kindId: k.kind_id,
    anzeige: k.anzeige,
    verknuepfungId: k.verknuepfung_id,
    status: k.status,
    quelle: k.quelle,
    unter16: k.unter_16,
    nachrichtenErlaubt: k.nachrichten_erlaubt,
    mapErlaubt: k.map_erlaubt,
    spotlightsNurKontakte: k.spotlights_nur_kontakte,
    pushErlaubt: k.push_erlaubt,
  }));
}

export async function getMeineEltern(supabase: SupabaseClient): Promise<Elternteil[]> {
  const { data } = await supabase.rpc("meine_eltern");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((e) => ({ verknuepfungId: e.verknuepfung_id, elternId: e.eltern_id, anzeige: e.anzeige, status: e.status }));
}

export async function getMeineSchutzEinstellungen(supabase: SupabaseClient): Promise<MeineSchutzEinstellungen> {
  const { data } = await supabase.rpc("meine_kind_einstellungen");
  // deno-lint-ignore no-explicit-any
  const e = ((data ?? []) as any[])[0];
  return {
    hatEltern: !!e?.hat_eltern,
    unter16: e?.unter_16 ?? true,
    nachrichtenErlaubt: e?.nachrichten_erlaubt ?? true,
    mapErlaubt: !!e?.map_erlaubt,
    spotlightsNurKontakte: e?.spotlights_nur_kontakte ?? true,
    pushErlaubt: !!e?.push_erlaubt,
  };
}

// Alter in ganzen Jahren (Europe/Berlin), Grundlage fuer die Anzeige – die Regeln prueft die Datenbank.
export { alterAm } from "@/lib/auth/alter";
