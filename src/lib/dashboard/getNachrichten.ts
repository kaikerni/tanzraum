import type { SupabaseClient } from "@supabase/supabase-js";

export type AktuelleNachricht = {
  id: string;
  inhalt: string;
  gesendetAm: string;
  senderName: string;
  ungelesen: boolean;
};

/**
 * Bewusst OHNE Admin-Bypass -- zeigt nur Nachrichten aus Gespraechen, in denen der
 * eingeloggte Nutzer selbst Teilnehmer ist (normale RLS via hat_gespraech_zugriff).
 * Ein Plattform-Admin soll hier keine fremden privaten Chats lesen koennen.
 */
export async function getAktuelleNachrichten(
  supabase: SupabaseClient,
  userId: string,
  anzahl = 4,
): Promise<AktuelleNachricht[]> {
  const { data: teilnahmen } = await supabase
    .from("gespraech_teilnehmer")
    .select("gespraech_id, last_read_at")
    .eq("user_id", userId);

  const gespraechIds = (teilnahmen ?? []).map((t) => t.gespraech_id);
  if (gespraechIds.length === 0) return [];
  const gelesenBis = new Map((teilnahmen ?? []).map((t) => [t.gespraech_id, t.last_read_at as string | null]));

  const { data, error } = await supabase
    .from("nachrichten")
    .select("id, inhalt, gesendet_am, sender_id, gespraech_id")
    .in("gespraech_id", gespraechIds)
    .order("gesendet_am", { ascending: false })
    .limit(anzahl);

  if (error || !data || data.length === 0) return [];

  const senderIds = [...new Set(data.map((n) => n.sender_id))];
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, vorname, nachname")
    .in("id", senderIds);

  const nameById = new Map(
    (profile ?? []).map((p) => [p.id, [p.vorname, p.nachname].filter(Boolean).join(" ") || "Unbekannt"]),
  );

  return data.map((n) => ({
    id: n.id,
    inhalt: n.inhalt,
    gesendetAm: n.gesendet_am,
    senderName: nameById.get(n.sender_id) ?? "Unbekannt",
    ungelesen: (() => {
      if (n.sender_id === userId) return false;
      const bis = gelesenBis.get(n.gespraech_id);
      return !bis || new Date(n.gesendet_am) > new Date(bis);
    })(),
  }));
}
