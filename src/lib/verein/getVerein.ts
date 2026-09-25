import type { SupabaseClient } from "@supabase/supabase-js";

export type VereinsDetails = {
  id: string;
  name: string;
  kuerzel: string | null;
  logoUrl: string | null;
  beschreibung: string | null;
  ansprechpartner: string | null;
  email: string | null;
  telefon: string | null;
  webseite: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  tarif: string | null;
  verbandId: string | null;
  verbandName: string | null;
};

export type GruppeUebersicht = {
  id: string;
  name: string | null;
  altersklasseId: string | null;
  altersklasse: string | null;
  disziplinId: string | null;
  disziplin: string | null;
  thema: string | null;
  anzahl: number;
  trainer: string[];
  betreuer: string[];
};

export type VereinUebersicht = {
  meineRolle: string | null;
  meineGruppen: string[];
  lizenz: boolean;
  mitgliederAnzahl: number;
  gruppen: GruppeUebersicht[];
  ansprechpartner: { name: string; rolle: string }[];
};

export type Auswahl = { id: string; name: string };

export async function getVereinsDetails(supabase: SupabaseClient, vereinId: string): Promise<VereinsDetails | null> {
  const { data } = await supabase
    .from("vereine")
    .select(
      "id, name, kuerzel, logo_url, beschreibung, ansprechpartner, email, telefon, webseite, strasse, hausnummer, plz, ort, tarif, verband_id, verbaende(name)",
    )
    .eq("id", vereinId)
    .maybeSingle();
  if (!data) return null;
  // deno-lint-ignore no-explicit-any
  const v = data as any;
  return {
    id: v.id,
    name: v.name,
    kuerzel: v.kuerzel,
    logoUrl: v.logo_url,
    beschreibung: v.beschreibung,
    ansprechpartner: v.ansprechpartner,
    email: v.email,
    telefon: v.telefon,
    webseite: v.webseite,
    strasse: v.strasse,
    hausnummer: v.hausnummer,
    plz: v.plz,
    ort: v.ort,
    tarif: v.tarif,
    verbandId: v.verband_id,
    verbandName: v.verbaende?.name ?? null,
  };
}

export async function getVereinUebersicht(supabase: SupabaseClient, vereinId: string): Promise<VereinUebersicht | null> {
  const { data, error } = await supabase.rpc("verein_uebersicht", { p_verein_id: vereinId });
  if (error || !data) return null;
  // deno-lint-ignore no-explicit-any
  const d = data as any;
  return {
    meineRolle: d.meine_rolle,
    meineGruppen: d.meine_gruppen ?? [],
    lizenz: Boolean(d.lizenz),
    mitgliederAnzahl: Number(d.mitglieder_anzahl ?? 0),
    // deno-lint-ignore no-explicit-any
    gruppen: (d.gruppen ?? []).map((g: any) => ({
      id: g.id,
      name: g.name,
      altersklasseId: g.altersklasse_id,
      altersklasse: g.altersklasse,
      disziplinId: g.disziplin_id,
      disziplin: g.disziplin,
      thema: g.thema,
      anzahl: Number(g.anzahl ?? 0),
      trainer: g.trainer ?? [],
      betreuer: g.betreuer ?? [],
    })),
    ansprechpartner: d.ansprechpartner ?? [],
  };
}

export async function getAuswahllisten(supabase: SupabaseClient) {
  const [{ data: altersklassen }, { data: disziplinen }, { data: rollen }, { data: verbaende }] = await Promise.all([
    supabase.from("altersklassen").select("id, name").order("sortierung"),
    supabase.from("disziplinen").select("id, name").order("sortierung"),
    supabase.from("rollen").select("id, name").order("name"),
    supabase.from("verbaende").select("id, name, kuerzel").eq("aktiv", true).order("sortierung"),
  ]);
  return {
    altersklassen: (altersklassen ?? []) as Auswahl[],
    disziplinen: (disziplinen ?? []) as Auswahl[],
    rollen: (rollen ?? []) as Auswahl[],
    verbaende: ((verbaende ?? []) as { id: string; name: string; kuerzel: string }[]).map((v) => ({
      id: v.id,
      name: `${v.kuerzel} – ${v.name}`,
    })),
  };
}

export type OffeneEinladung = {
  id: string;
  token: string;
  rolle: string | null;
  gruppe: string | null;
  laeuftAb: string | null;
  uses: number;
  maxUses: number;
};

export async function getOffeneEinladungen(supabase: SupabaseClient, vereinId: string): Promise<OffeneEinladung[]> {
  const { data } = await supabase
    .from("einladungen")
    .select("id, token, expires_at, uses, max_uses, revoked, rollen(name), gruppen(name)")
    .eq("verein_id", vereinId)
    .eq("revoked", false)
    .order("created_at", { ascending: false });
  const jetzt = Date.now();
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[])
    .filter((e) => e.uses < e.max_uses && (!e.expires_at || new Date(e.expires_at).getTime() > jetzt))
    .map((e) => ({
      id: e.id,
      token: e.token,
      rolle: e.rollen?.name ?? null,
      gruppe: e.gruppen?.name ?? null,
      laeuftAb: e.expires_at,
      uses: e.uses,
      maxUses: e.max_uses,
    }));
}
