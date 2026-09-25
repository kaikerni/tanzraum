import type { SupabaseClient } from "@supabase/supabase-js";

// TanzRaum-Netzwerk (Map, Liste, Profile). Alle Sichtbarkeits- und Jugendschutzregeln prueft die Datenbank.

export type MapPunkt = {
  art: "verein" | "person";
  id: string;
  name: string;
  zeile: string | null;
  lat: number;
  lng: number;
  avatarUrl: string | null;
};

export type NetzwerkKategorie = "mitglieder" | "vereine" | "gruppen" | "trainer";

export type ListenTreffer = {
  art: "person" | "verein" | "gruppe";
  id: string;
  name: string;
  zeile1: string | null;
  zeile2: string | null;
  avatarUrl: string | null;
  vereinId: string | null;
  status: "verbunden" | "angefragt" | "eingehend" | "abgelehnt" | null;
};

export type PersonProfil = {
  id: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  privat: boolean;
  ich: boolean;
  ort: string | null;
  vereine: { id: string; name: string; ort: string | null; rolle: string }[];
  gruppen: { id: string; name: string; verein: string; funktion: string | null; disziplin: string | null; altersklasse: string | null }[];
  status: ListenTreffer["status"];
  darfSchreiben: boolean;
  sperrgrund: string | null;
  kannVernetzen: boolean;
  blockiertVonMir: boolean;
};

export type VereinProfil = {
  id: string;
  name: string;
  kuerzel: string | null;
  logoUrl: string | null;
  beschreibung: string | null;
  webseite: string | null;
  ort: string | null;
  plz: string | null;
  lat: number | null;
  lng: number | null;
  ichMitglied: boolean;
  mitgliederAnzahl: number;
  gruppen: { id: string; name: string; disziplin: string | null; altersklasse: string | null; trainer: string | null }[];
  trainer: { id: string; name: string; rolle: string }[];
  mitglieder: { id: string; name: string; rolle: string; avatarUrl: string | null }[];
};

export async function darfNetzwerk(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("mein_tarif");
  return data === "basic" || data === "verein";
}

export async function getMapPunkte(supabase: SupabaseClient): Promise<MapPunkt[]> {
  const { data } = await supabase.rpc("netzwerk_map");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((p) => ({
    art: p.art,
    id: p.id,
    name: p.name,
    zeile: p.zeile || null,
    lat: p.lat,
    lng: p.lng,
    avatarUrl: p.avatar_url,
  }));
}

// deno-lint-ignore no-explicit-any
export function alsTreffer(t: any): ListenTreffer {
  return {
    art: t.art,
    id: t.id,
    name: t.name,
    zeile1: t.zeile1 || null,
    zeile2: t.zeile2 || null,
    avatarUrl: t.avatar_url,
    vereinId: t.verein_id,
    status: t.status,
  };
}

export async function getPerson(supabase: SupabaseClient, id: string): Promise<PersonProfil | null> {
  const { data } = await supabase.rpc("netzwerk_person", { p_user_id: id });
  if (!data) return null;
  // deno-lint-ignore no-explicit-any
  const p = data as any;
  return {
    id: p.id,
    name: p.name,
    handle: p.handle,
    avatarUrl: p.avatar_url,
    privat: p.privat,
    ich: p.ich,
    ort: p.ort,
    vereine: p.vereine ?? [],
    gruppen: p.gruppen ?? [],
    status: p.status,
    darfSchreiben: p.darf_schreiben,
    sperrgrund: p.sperrgrund,
    kannVernetzen: p.kann_vernetzen,
    blockiertVonMir: p.blockiert_von_mir,
  };
}

export async function getVereinProfil(supabase: SupabaseClient, id: string): Promise<VereinProfil | null> {
  const { data } = await supabase.rpc("netzwerk_verein", { p_verein_id: id });
  if (!data) return null;
  // deno-lint-ignore no-explicit-any
  const v = data as any;
  return {
    id: v.id,
    name: v.name,
    kuerzel: v.kuerzel,
    logoUrl: v.logo_url,
    beschreibung: v.beschreibung,
    webseite: v.webseite,
    ort: v.ort,
    plz: v.plz,
    lat: v.lat,
    lng: v.lng,
    ichMitglied: v.ich_mitglied,
    mitgliederAnzahl: v.mitglieder_anzahl,
    gruppen: v.gruppen ?? [],
    trainer: v.trainer ?? [],
    // deno-lint-ignore no-explicit-any
    mitglieder: (v.mitglieder ?? []).map((m: any) => ({ id: m.id, name: m.name, rolle: m.rolle, avatarUrl: m.avatar_url })),
  };
}
