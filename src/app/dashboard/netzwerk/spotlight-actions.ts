"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { Spotlight, SpotlightPerson } from "@/lib/spotlights/typen";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STICKER = /^[a-z]\d{2,3}$/;

export async function spotlightLeiste(): Promise<SpotlightPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("spotlight_leiste");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((p) => ({
    userId: p.user_id,
    name: p.name,
    avatarUrl: p.avatar_url,
    anzahl: p.anzahl,
    ungesehen: p.ungesehen,
    neuestes: p.neuestes,
    ich: p.ich,
  }));
}

// Spotlights einer Person inkl. kurzlebiger, signierter Medien-Links (privater Bucket)
export async function spotlightsVon(userId: string): Promise<Spotlight[]> {
  if (!UUID.test(userId)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("spotlights_von", { p_user_id: userId });
  // deno-lint-ignore no-explicit-any
  const zeilen = (data ?? []) as any[];
  const pfade = zeilen.map((z) => z.media_path).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (pfade.length > 0) {
    const { data: signiert } = await supabase.storage.from("spotlights").createSignedUrls(pfade, 60 * 60);
    for (const s of signiert ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return zeilen.map((z) => ({
    id: z.id,
    mediaTyp: z.media_typ,
    url: z.media_path ? (urls.get(z.media_path) ?? null) : null,
    text: z.text,
    hintergrund: z.hintergrund,
    sticker: z.sticker,
    sichtbarkeit: z.sichtbarkeit,
    erstelltAm: z.erstellt_am,
    ablaufAm: z.ablauf_am,
    gesehen: z.gesehen,
    meineReaktion: z.meine_reaktion,
    ansichten: z.ansichten,
    reaktionen: z.reaktionen,
  }));
}

export async function spotlightErstellen(eingabe: {
  mediaPfad: string | null;
  mediaTyp: "foto" | "video" | "text";
  text: string;
  hintergrund: string | null;
  sticker: string | null;
  sichtbarkeit: "netzwerk" | "kontakte";
}): Promise<AktionsErgebnis> {
  if (eingabe.sticker && !STICKER.test(eingabe.sticker)) return { error: "Ungültiger Smiley." };
  const supabase = await createClient();
  // Besitzer ist immer der angemeldete Nutzer – kein "Posten als Verein/Gruppe"
  const { error } = await supabase.rpc("spotlight_erstellen", {
    p_media_path: eingabe.mediaPfad,
    p_media_typ: eingabe.mediaTyp,
    p_text: eingabe.text.slice(0, 500),
    p_hintergrund: eingabe.hintergrund,
    p_sticker: eingabe.sticker,
    p_sichtbarkeit: eingabe.sichtbarkeit,
  });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/netzwerk");
  return { error: null, ok: "Dein Spotlight ist 24 Stunden sichtbar." };
}

export async function spotlightGesehen(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.rpc("spotlight_gesehen", { p_id: id });
}

export async function spotlightReagieren(id: string, sticker: string | null): Promise<AktionsErgebnis> {
  if (!UUID.test(id) || (sticker && !STICKER.test(sticker))) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("spotlight_reagieren", { p_id: id, p_sticker: sticker });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null };
}

export async function spotlightLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("spotlight_loeschen", { p_id: id });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/netzwerk");
  return { error: null, ok: "Spotlight gelöscht." };
}
