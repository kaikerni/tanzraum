"use server";

import { sperrgrundText } from "@/lib/chat/sperrgrund";
import { istReaktion } from "@/lib/chat/emojis";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { SuchTreffer } from "@/lib/chat/getChat";

// Alle Rechte prueft die Datenbank (RPCs mit SECURITY DEFINER + RLS). Hier nur Weiterleitung und Fehlermeldungen.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

export async function chatEinstellung(gespraechId: string, nurLeitung: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("chat_einstellung", { p_gespraech_id: gespraechId, p_nur_leitung_schreibt: nurLeitung });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(`/dashboard/nachrichten/${gespraechId}`);
  return { error: null, ok: nurLeitung ? "Jetzt schreiben nur noch Vorstand, Trainer und Betreuer." : "Jetzt dürfen alle schreiben." };
}

export async function nachrichtLoeschen(nachrichtId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(nachrichtId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data: dateien, error } = await supabase.rpc("nachricht_loeschen", { p_nachricht_id: nachrichtId });
  if (error) return { error: freundlicherFehler(error) };
  for (const d of (dateien ?? []) as { bucket: string; pfad: string }[]) {
    await supabase.storage.from(d.bucket).remove([d.pfad]);
  }
  return { error: null };
}

export async function umfrageAbstimmen(nachrichtId: string, optionen: number[]): Promise<AktionsErgebnis> {
  if (!UUID.test(nachrichtId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("umfrage_abstimmen", { p_nachricht_id: nachrichtId, p_optionen: optionen });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null };
}

export async function nutzerSuchen(suche: string): Promise<SuchTreffer[]> {
  const supabase = await sitzung();
  const { data } = await supabase.rpc("nutzer_suchen", { p_suche: suche.slice(0, 60) });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((t) => ({
    userId: t.user_id,
    anzeige: t.anzeige,
    handle: t.handle,
    avatarUrl: t.avatar_url,
    status: t.status,
    darfSchreiben: t.darf_schreiben,
  }));
}

export async function chatStummSetzen(gespraechId: string, stumm: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("chat_stumm_setzen", { p_gespraech_id: gespraechId, p_stumm: stumm });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null };
}

export type KontaktErgebnis = AktionsErgebnis & {
  ergebnis?: "chat" | "anfrage_noetig" | "angefragt" | "eingehend" | "abgelehnt" | "nicht_moeglich";
  ichUnter16?: boolean;
};

// Privatchat oeffnen, wenn erlaubt; sonst sagt die Datenbank, ob eine Kontaktanfrage noetig ist.
export async function kontaktAufnehmen(userId: string): Promise<KontaktErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("kontakt_aufnehmen", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  // deno-lint-ignore no-explicit-any
  const r = ((data ?? []) as any[])[0];
  if (r?.ergebnis === "chat" && r.gespraech_id) redirect(`/dashboard/nachrichten/${r.gespraech_id}`);
  const texte: Record<string, string> = {
    angefragt: "Deine Buddy-Anfrage ist noch offen.",
    eingehend: "Diese Person hat dir eine Buddy-Anfrage geschickt – du findest sie unter „Buddy-Anfragen“.",
    abgelehnt: "Diese Person hat deine Buddy-Anfrage abgelehnt.",
    nicht_moeglich: "Eine Kontaktaufnahme mit dieser Person ist nicht möglich.",
  };
  if (r?.ergebnis === "nicht_moeglich") {
    // Genauer Grund (Jugendschutz, Tarif, Elternsperre …) aus der Datenbank
    const { data: grund } = await supabase.rpc("schreib_sperrgrund", { p_user_id: userId });
    return { error: sperrgrundText(grund as string | null), ergebnis: r.ergebnis, ichUnter16: r.ich_unter_16 };
  }
  return { error: r?.ergebnis === "anfrage_noetig" ? null : (texte[r?.ergebnis] ?? "Nicht möglich."), ergebnis: r?.ergebnis, ichUnter16: r?.ich_unter_16 };
}

export async function kontaktanfrageSenden(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("kontaktanfrage_senden", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  if (data === "direkt" || data === "angenommen") return kontaktAufnehmen(userId);
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Buddy-Anfrage gesendet. Sobald sie angenommen wird, seid ihr Buddys." };
}

export async function kontaktanfrageBeantworten(userId: string, aktion: "annehmen" | "ablehnen" | "blockieren"): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("kontaktanfrage_beantworten", { p_user_id: userId, p_aktion: aktion });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  if (aktion === "annehmen" && data) redirect(`/dashboard/nachrichten/${data}`);
  return { error: null, ok: aktion === "blockieren" ? "Person blockiert." : "Anfrage abgelehnt." };
}

export async function kontaktanfrageZurueckziehen(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("kontaktanfrage_zurueckziehen", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Anfrage zurückgezogen." };
}

export async function nutzerBlockieren(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("nutzer_blockieren", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Person blockiert." };
}

export async function nutzerFreigeben(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("nutzer_freigeben", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Blockierung aufgehoben." };
}

export async function reagieren(nachrichtId: string, emoji: string | null): Promise<AktionsErgebnis> {
  // TanzRaum-Sticker oder normales Smiley
  if (!UUID.test(nachrichtId) || (emoji !== null && !istReaktion(emoji))) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("nachricht_reagieren", { p_nachricht_id: nachrichtId, p_emoji: emoji });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null };
}

export async function nachrichtBearbeiten(nachrichtId: string, inhalt: string): Promise<AktionsErgebnis> {
  if (!UUID.test(nachrichtId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("nachricht_bearbeiten", { p_nachricht_id: nachrichtId, p_inhalt: inhalt.slice(0, 4000) });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null };
}

export type WeiterleitZiel = { id: string; name: string; untertitel: string | null; typ: string };

// Chats, in die man gerade schreiben darf (Pruefung beim Weiterleiten erneut in der Datenbank)
export async function weiterleitZiele(): Promise<WeiterleitZiel[]> {
  const supabase = await sitzung();
  const { data } = await supabase.rpc("chat_liste");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[])
    .filter((c) => c.darf_schreiben)
    .map((c) => ({ id: c.id, name: c.name, untertitel: c.untertitel, typ: c.typ }));
}

export async function nachrichtWeiterleiten(nachrichtId: string, zielId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(nachrichtId) || !UUID.test(zielId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("nachricht_weiterleiten", { p_nachricht_id: nachrichtId, p_ziel_gespraech_id: zielId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Weitergeleitet." };
}

export async function chatUngelesenMarkieren(gespraechId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("chat_ungelesen_markieren", { p_gespraech_id: gespraechId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  redirect("/dashboard/nachrichten");
}

export type SuchErgebnis = { id: string; inhalt: string; senderName: string; eigene: boolean; gesendetAm: string };

export async function chatSuchen(gespraechId: string, suche: string): Promise<SuchErgebnis[]> {
  if (!UUID.test(gespraechId) || suche.trim().length < 2) return [];
  const supabase = await sitzung();
  const { data } = await supabase.rpc("chat_suchen", { p_gespraech_id: gespraechId, p_suche: suche.slice(0, 100) });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, inhalt: r.inhalt, senderName: r.sender_name, eigene: r.eigene, gesendetAm: r.gesendet_am }));
}

// ---------- Gruppenchats (ab BASIC; Pruefung in der Datenbank) ----------

export type GruppenKandidat = { userId: string; anzeige: string; handle: string | null; avatarUrl: string | null; grund: string };
export type GruppenMitglied = { userId: string; anzeige: string; avatarUrl: string | null; istLeitung: boolean; ich: boolean };

export async function gruppenchatKandidaten(): Promise<GruppenKandidat[]> {
  const supabase = await sitzung();
  const { data } = await supabase.rpc("gruppenchat_kandidaten");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((k) => ({ userId: k.user_id, anzeige: k.anzeige, handle: k.handle, avatarUrl: k.avatar_url, grund: k.grund }));
}

export async function gruppenchatErstellen(name: string, mitglieder: string[]): Promise<AktionsErgebnis> {
  const ids = mitglieder.filter((m) => UUID.test(m)).slice(0, 99);
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("gruppenchat_erstellen", { p_name: name.trim().slice(0, 60), p_mitglieder: ids });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  redirect(`/dashboard/nachrichten/${data}`);
}

export async function gruppenchatMitglieder(gespraechId: string): Promise<GruppenMitglied[]> {
  if (!UUID.test(gespraechId)) return [];
  const supabase = await sitzung();
  const { data } = await supabase.rpc("gruppenchat_mitglieder", { p_gespraech_id: gespraechId });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((m) => ({ userId: m.user_id, anzeige: m.anzeige, avatarUrl: m.avatar_url, istLeitung: m.ist_leitung, ich: m.ich }));
}

export async function gruppenchatHinzufuegen(gespraechId: string, mitglieder: string[]): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("gruppenchat_mitglieder_hinzufuegen", { p_gespraech_id: gespraechId, p_mitglieder: mitglieder.filter((m) => UUID.test(m)) });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(`/dashboard/nachrichten/${gespraechId}`);
  return { error: null, ok: Number(data) === 1 ? "1 Person hinzugefügt." : `${Number(data ?? 0)} Personen hinzugefügt.` };
}

export async function gruppenchatEntfernen(gespraechId: string, userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId) || !UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("gruppenchat_mitglied_entfernen", { p_gespraech_id: gespraechId, p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(`/dashboard/nachrichten/${gespraechId}`);
  return { error: null, ok: "Aus der Gruppe entfernt." };
}

export async function gruppenchatUmbenennen(gespraechId: string, name: string): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("gruppenchat_umbenennen", { p_gespraech_id: gespraechId, p_name: name.trim().slice(0, 60) });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: "Name gespeichert." };
}

export async function gruppenchatVerlassen(gespraechId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(gespraechId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("gruppenchat_verlassen", { p_gespraech_id: gespraechId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  redirect("/dashboard/nachrichten/gruppen");
}

// Nachricht in einem geschuetzten Chat melden (geht in die bestehenden Meldungen, Bereich „chat“)
export async function chatNachrichtMelden(nachrichtId: string, grund: string, text: string): Promise<AktionsErgebnis> {
  if (!UUID.test(nachrichtId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("chat_nachricht_melden", { p_nachricht_id: nachrichtId, p_grund: grund, p_text: text.slice(0, 1000) });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null, ok: "Danke! Deine Meldung ist bei der TanzRaum-Moderation." };
}

// Chatregeln des TanzRaum Chats einmalig bestaetigen
export async function chatRegelnBestaetigen(): Promise<AktionsErgebnis> {
  const supabase = await sitzung();
  const { error } = await supabase.rpc("chat_regeln_bestaetigen");
  if (error) return { error: freundlicherFehler(error) };
  return { error: null };
}
