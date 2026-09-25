import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatTyp = "dm" | "verein" | "trainingsgruppe" | "juryraum";
export type ChatBereich = "netzwerk" | "verein" | "gruppe" | "privat";

export type ChatEintrag = {
  id: string;
  typ: ChatTyp;
  bereich: ChatBereich;
  name: string;
  untertitel: string | null;
  partnerId: string | null;
  partnerRolle: string | null;
  blockiert: boolean;
  avatarUrl: string | null;
  letzteNachricht: string | null;
  letzteZeit: string;
  letzterSender: string | null;
  ungelesen: number;
  darfSchreiben: boolean;
  istLeitung: boolean;
  nurLeitungSchreibt: boolean;
};

export type ChatKopf = {
  id: string;
  typ: ChatTyp;
  name: string;
  untertitel: string | null;
  partnerId: string | null;
  avatarUrl: string | null;
  darfSchreiben: boolean;
  istLeitung: boolean;
  nurLeitungSchreibt: boolean;
  partnerGelesenBis: string | null;
  partnerRolle: string | null;
  ichHabeBlockiert: boolean;
  partnerBlockiert: boolean;
};

export type Umfrage = {
  frage: string;
  optionen: string[];
  mehrfach: boolean;
  stimmen: number[];
  meine: number[];
  teilnehmer: number;
};

export type Anhang = { art: "datei" | "video" | "audio"; pfad: string; name: string; groesse: number | null; typ: string | null; dauer: number | null };
export type Standort = { lat: number; lng: number; genauigkeit: number | null };
export type Reaktion = { emoji: string; anzahl: number; ich: boolean };

export type ChatNachricht = {
  id: string;
  senderId: string;
  senderName: string;
  eigene: boolean;
  inhalt: string;
  bildPfad: string | null;
  umfrage: Umfrage | null;
  anhang: Anhang | null;
  standort: Standort | null;
  sticker: string | null;
  reaktionen: Reaktion[];
  antwortAuf: string | null;
  antwortSender: string | null;
  antwortText: string | null;
  antwortSticker: string | null;
  gesendetAm: string;
  geloescht: boolean;
  darfLoeschen: boolean;
};

export type Kontakt = { userId: string; anzeige: string; handle: string | null; avatarUrl: string | null; grund: string };
export type Kontaktanfrage = {
  userId: string;
  anzeige: string;
  handle: string | null;
  avatarUrl: string | null;
  richtung: "eingehend" | "ausgehend" | "blockiert";
};
export type SuchTreffer = {
  userId: string;
  anzeige: string;
  handle: string | null;
  avatarUrl: string | null;
  status: "verbunden" | "angefragt" | "eingehend" | "abgelehnt" | null;
  darfSchreiben: boolean;
};

// deno-lint-ignore no-explicit-any
export function alsChatEintrag(c: any): ChatEintrag {
  return {
    id: c.id,
    typ: c.typ,
    bereich: c.bereich,
    name: c.name,
    untertitel: c.untertitel,
    partnerId: c.partner_id,
    partnerRolle: c.partner_rolle,
    blockiert: c.blockiert,
    avatarUrl: c.avatar_url,
    letzteNachricht: c.letzte_nachricht,
    letzteZeit: c.letzte_zeit,
    letzterSender: c.letzter_sender,
    ungelesen: c.ungelesen,
    darfSchreiben: c.darf_schreiben,
    istLeitung: c.ist_leitung,
    nurLeitungSchreibt: c.nur_leitung_schreibt,
  };
}

// deno-lint-ignore no-explicit-any
export function alsNachricht(n: any): ChatNachricht {
  return {
    id: n.id,
    senderId: n.sender_id,
    senderName: n.sender_name,
    eigene: n.eigene,
    inhalt: n.inhalt,
    bildPfad: n.bild_pfad,
    umfrage: n.umfrage,
    anhang: n.anhang,
    standort: n.standort,
    sticker: n.sticker ?? null,
    reaktionen: n.reaktionen ?? [],
    antwortAuf: n.antwort_auf,
    antwortSender: n.antwort_sender,
    antwortText: n.antwort_text,
    antwortSticker: n.antwort_sticker ?? null,
    gesendetAm: n.gesendet_am,
    geloescht: n.geloescht,
    darfLoeschen: n.darf_loeschen,
  };
}

export async function getChatListe(supabase: SupabaseClient): Promise<ChatEintrag[]> {
  const { data } = await supabase.rpc("chat_liste");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map(alsChatEintrag);
}

export async function getChatKopf(supabase: SupabaseClient, id: string): Promise<ChatKopf | null> {
  const { data } = await supabase.rpc("chat_kopf", { p_gespraech_id: id });
  // deno-lint-ignore no-explicit-any
  const k = ((data ?? []) as any[])[0];
  if (!k) return null;
  return {
    id: k.id,
    typ: k.typ,
    name: k.name,
    untertitel: k.untertitel,
    partnerId: k.partner_id,
    avatarUrl: k.avatar_url,
    darfSchreiben: k.darf_schreiben,
    istLeitung: k.ist_leitung,
    nurLeitungSchreibt: k.nur_leitung_schreibt,
    partnerGelesenBis: k.partner_gelesen_bis,
    partnerRolle: k.partner_rolle,
    ichHabeBlockiert: k.ich_habe_blockiert,
    partnerBlockiert: k.partner_blockiert,
  };
}

export async function getChatNachrichten(supabase: SupabaseClient, id: string, vor?: string): Promise<ChatNachricht[]> {
  const { data } = await supabase.rpc("chat_nachrichten", { p_gespraech_id: id, p_vor: vor ?? null, p_anzahl: 60 });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map(alsNachricht);
}

export async function signierteBildUrls(supabase: SupabaseClient, pfade: string[]): Promise<Record<string, string>> {
  const eindeutig = [...new Set(pfade)];
  if (eindeutig.length === 0) return {};
  const { data } = await supabase.storage.from("chat-bilder").createSignedUrls(eindeutig, 60 * 60);
  const urls: Record<string, string> = {};
  for (const e of data ?? []) if (e.path && e.signedUrl) urls[e.path] = e.signedUrl;
  return urls;
}

export async function getKontakte(supabase: SupabaseClient): Promise<Kontakt[]> {
  const { data } = await supabase.rpc("chat_kontakte");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((k) => ({ userId: k.user_id, anzeige: k.anzeige, handle: k.handle, avatarUrl: k.avatar_url, grund: k.grund }));
}

export async function getKontaktanfragen(supabase: SupabaseClient): Promise<Kontaktanfrage[]> {
  const { data } = await supabase.rpc("meine_kontaktanfragen");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((k) => ({ userId: k.user_id, anzeige: k.anzeige, handle: k.handle, avatarUrl: k.avatar_url, richtung: k.richtung }));
}
