import type { SupabaseClient } from "@supabase/supabase-js";

// Chats mit TanzRaum Schutzpruefung: Nachrichten werden VOR dem Speichern serverseitig geprueft (Edge Function chat-senden).
// Privatchats (1:1) und JuryRaum bleiben unveraendert.
export const GESCHUETZTE_CHATS = ["tanzraum", "verein", "trainingsgruppe", "gruppenchat"] as const;
export const istGeschuetzt = (typ: string) => (GESCHUETZTE_CHATS as readonly string[]).includes(typ);

export type GeschuetzteNachricht = {
  inhalt?: string;
  antwort_auf?: string | null;
  bild_pfad?: string | null;
  anhang?: Record<string, unknown> | null;
  umfrage?: { frage: string; optionen: string[]; mehrfach: boolean } | null;
  standort?: { lat: number; lng: number; genauigkeit: number } | null;
  sticker?: string | null;
};

export const SCHUTZ_FEHLER = "Die Nachricht konnte nicht gesendet werden.";

// Sendet ueber die Schutzpruefung. Bei Ablehnung kommt nur eine neutrale Meldung zurueck (keine Details zur Regel).
export async function geschuetztSenden(
  supabase: SupabaseClient,
  gespraechId: string,
  nachricht: GeschuetzteNachricht,
  bearbeiten?: string,
): Promise<{ ok: true; id: string } | { ok: false; fehler: string }> {
  const { data, error } = await supabase.functions.invoke("chat-senden", {
    body: { gespraech_id: gespraechId, art: bearbeiten ? "bearbeiten" : "neu", nachricht_id: bearbeiten ?? null, nachricht },
  });
  if (error || !data) return { ok: false, fehler: "Deine Nachricht konnte gerade nicht geprüft werden. Bitte versuche es später erneut." };
  const d = data as { ok?: boolean; id?: string; fehler?: string };
  if (d.ok && d.id) return { ok: true, id: d.id };
  return { ok: false, fehler: d.fehler || SCHUTZ_FEHLER };
}

export const MELDEGRUENDE_CHAT: { id: string; label: string }[] = [
  { id: "beleidigung", label: "Beleidigung" },
  { id: "belaestigung", label: "Belästigung" },
  { id: "mobbing", label: "Mobbing" },
  { id: "unangemessen", label: "Unangemessener Inhalt" },
  { id: "sexualisiert", label: "Sexualisierter Inhalt" },
  { id: "spam", label: "Spam/Werbung" },
  { id: "persoenliche_daten", label: "Persönliche Daten" },
  { id: "regelverstoss", label: "Verstoß gegen TanzRaum-Regeln" },
  { id: "sonstiges", label: "Sonstiges" },
];

export type Absender = { avatarUrl: string | null; verein: string | null; kennzeichen: string | null };
