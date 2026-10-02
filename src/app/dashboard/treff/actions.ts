"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// 💬 TanzRaum Treff – alle Aktionen laufen ueber Datenbankfunktionen, die Tarif, Jugendschutz, Sperren und
// Team-Rechte pruefen (direkte Aufrufe ohne Recht werden dort abgewiesen).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PFAD = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

function neuLaden(themaId?: string) {
  revalidatePath("/dashboard/treff", "layout");
  if (themaId) revalidatePath(`/dashboard/treff/thema/${themaId}`);
}

function fehler(e: { code?: string; message?: string }): AktionsErgebnis {
  return { error: freundlicherFehler(e) };
}

export async function themaErstellen(e: {
  kategorie: string;
  titel: string;
  inhalt: string;
  link: string;
  bildPfad: string | null;
  dateiPfad: string | null;
  dateiName: string | null;
}): Promise<AktionsErgebnis & { id?: string }> {
  if (!UUID.test(e.kategorie)) return { error: "Bitte eine Kategorie auswählen." };
  if (e.titel.trim().length < 5) return { error: "Der Titel braucht mindestens 5 Zeichen." };
  if (!e.inhalt.trim()) return { error: "Bitte schreib etwas zum Thema." };
  if (e.link.trim() && !/^https?:\/\/\S+$/.test(e.link.trim())) return { error: "Der Link muss mit https:// beginnen." };
  if ((e.bildPfad && !PFAD.test(e.bildPfad)) || (e.dateiPfad && !PFAD.test(e.dateiPfad))) return { error: "Die Datei konnte nicht zugeordnet werden." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("treff_thema_erstellen", {
    p_kategorie: e.kategorie,
    p_titel: e.titel.trim().slice(0, 160),
    p_inhalt: e.inhalt.trim().slice(0, 10000),
    p_link: e.link.trim() || null,
    p_bild_pfad: e.bildPfad,
    p_datei_pfad: e.dateiPfad,
    p_datei_name: e.dateiName,
  });
  if (error) return fehler(error);
  neuLaden();
  return { error: null, id: data as string, ok: "Thema veröffentlicht." };
}

export async function aehnlicheThemen(titel: string): Promise<{ id: string; titel: string; antworten: number; kategorie: string }[]> {
  if (titel.trim().length < 4) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("treff_aehnliche", { p_titel: titel.slice(0, 160) });
  return (data ?? []) as { id: string; titel: string; antworten: number; kategorie: string }[];
}

export async function themaBearbeiten(id: string, titel: string, inhalt: string, link: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiges Thema." };
  if (titel.trim().length < 5 || !inhalt.trim()) return { error: "Titel (mind. 5 Zeichen) und Inhalt sind nötig." };
  if (link.trim() && !/^https?:\/\/\S+$/.test(link.trim())) return { error: "Der Link muss mit https:// beginnen." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_thema_bearbeiten", { p_id: id, p_titel: titel.trim().slice(0, 160), p_inhalt: inhalt.trim().slice(0, 10000), p_link: link.trim() || null });
  if (error) return fehler(error);
  neuLaden(id);
  return { error: null, ok: "Gespeichert." };
}

export async function themaLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiges Thema." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_thema_loeschen", { p_id: id });
  if (error) return fehler(error);
  neuLaden(id);
  return { error: null, ok: "Thema gelöscht." };
}

export async function antworten(themaId: string, inhalt: string, bildPfad: string | null): Promise<AktionsErgebnis> {
  if (!UUID.test(themaId)) return { error: "Ungültiges Thema." };
  if (!inhalt.trim()) return { error: "Bitte schreib eine Antwort." };
  if (bildPfad && !PFAD.test(bildPfad)) return { error: "Das Bild konnte nicht zugeordnet werden." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_antworten", { p_thema_id: themaId, p_inhalt: inhalt.trim().slice(0, 10000), p_bild_pfad: bildPfad });
  if (error) return fehler(error);
  neuLaden(themaId);
  return { error: null, ok: "Antwort veröffentlicht." };
}

export async function beitragBearbeiten(id: string, themaId: string, inhalt: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiger Beitrag." };
  if (!inhalt.trim()) return { error: "Der Beitrag darf nicht leer sein." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_beitrag_bearbeiten", { p_id: id, p_inhalt: inhalt.trim().slice(0, 10000) });
  if (error) return fehler(error);
  neuLaden(themaId);
  return { error: null, ok: "Gespeichert." };
}

export async function beitragLoeschen(id: string, themaId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiger Beitrag." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_beitrag_loeschen", { p_id: id });
  if (error) return fehler(error);
  neuLaden(themaId);
  return { error: null, ok: "Beitrag gelöscht." };
}

export async function hilfreichSetzen(beitragId: string, an: boolean): Promise<AktionsErgebnis & { anzahl?: number }> {
  if (!UUID.test(beitragId)) return { error: "Ungültiger Beitrag." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("treff_hilfreich_setzen", { p_beitrag_id: beitragId, p_an: an });
  if (error) return fehler(error);
  return { error: null, anzahl: Number(data ?? 0) };
}

export async function besteAntwort(themaId: string, beitragId: string | null): Promise<AktionsErgebnis> {
  if (!UUID.test(themaId) || (beitragId && !UUID.test(beitragId))) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_beste_antwort", { p_thema_id: themaId, p_beitrag_id: beitragId });
  if (error) return fehler(error);
  neuLaden(themaId);
  return { error: null, ok: beitragId ? "Als beste Antwort markiert." : "Markierung entfernt." };
}

export async function empfehlen(themaId: string, beitragId: string | null, an: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(themaId) || (beitragId && !UUID.test(beitragId))) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_empfehlen", { p_thema_id: themaId, p_beitrag_id: beitragId, p_an: an });
  if (error) return fehler(error);
  neuLaden(themaId);
  return { error: null, ok: an ? "⭐ TanzRaum empfiehlt" : "Empfehlung entfernt." };
}

export async function folgen(themaId: string, an: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(themaId)) return { error: "Ungültiges Thema." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_folgen", { p_thema_id: themaId, p_an: an });
  if (error) return fehler(error);
  neuLaden(themaId);
  return { error: null, ok: an ? "Du folgst diesem Thema – neue Antworten siehst du in deinen Benachrichtigungen." : "Du folgst diesem Thema nicht mehr." };
}

export async function moderieren(themaId: string, aktion: "schliessen" | "oeffnen" | "anpinnen" | "entpinnen" | "verschieben", kategorie?: string): Promise<AktionsErgebnis> {
  if (!UUID.test(themaId) || (kategorie && !UUID.test(kategorie))) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_moderieren", { p_thema_id: themaId, p_aktion: aktion, p_kategorie: kategorie ?? null });
  if (error) return fehler(error);
  neuLaden(themaId);
  const text = { schliessen: "Thema geschlossen.", oeffnen: "Thema wieder geöffnet.", anpinnen: "Thema angepinnt.", entpinnen: "Thema nicht mehr angepinnt.", verschieben: "Thema verschoben." };
  return { error: null, ok: text[aktion] };
}

export async function melden(art: "thema" | "beitrag" | "nutzer", id: string, grund: string, text: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Meldung." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_melden", { p_art: art, p_id: id, p_grund: grund, p_text: text.slice(0, 1000) });
  if (error) return fehler(error);
  return { error: null, ok: "Danke! Deine Meldung ist eingegangen und wird vom TanzRaum-Team geprüft." };
}

export async function meldungSetzen(id: string, status: string, notiz: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Meldung." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_meldung_setzen", { p_id: id, p_status: status, p_notiz: notiz.slice(0, 2000) });
  if (error) return fehler(error);
  revalidatePath("/dashboard/treff/meldungen");
  return { error: null, ok: "Status gespeichert." };
}

export async function nutzerSperren(userId: string, bis: string | null, grund: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  if (bis && Number.isNaN(new Date(bis).getTime())) return { error: "Bitte ein gültiges Datum angeben." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_nutzer_sperren", { p_user_id: userId, p_bis: bis ? new Date(bis).toISOString() : null, p_grund: grund.slice(0, 500) });
  if (error) return fehler(error);
  neuLaden();
  return { error: null, ok: bis ? `Im Treff gesperrt bis ${new Date(bis).toLocaleDateString("de-DE")}.` : "Im Treff unbefristet gesperrt." };
}

export async function nutzerEntsperren(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_nutzer_entsperren", { p_user_id: userId });
  if (error) return fehler(error);
  neuLaden();
  return { error: null, ok: "Treff-Sperre aufgehoben." };
}

export async function nutzerEntfernen(userId: string, grund: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("treff_nutzer_entfernen", { p_user_id: userId, p_grund: grund.slice(0, 500) });
  if (error) return fehler(error);
  neuLaden();
  const d = (data ?? {}) as { themen?: number; beitraege?: number };
  return { error: null, ok: `Aus dem Treff entfernt: ${d.themen ?? 0} Themen und ${d.beitraege ?? 0} Beiträge ausgeblendet, Schreiben dauerhaft gesperrt.` };
}

export async function kategorieSpeichern(id: string | null, name: string, emoji: string, beschreibung: string, aktiv: boolean): Promise<AktionsErgebnis> {
  if (id && !UUID.test(id)) return { error: "Ungültige Kategorie." };
  if (name.trim().length < 2) return { error: "Bitte einen Namen angeben." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_kategorie_speichern", {
    p_id: id,
    p_name: name.trim().slice(0, 60),
    p_emoji: emoji.trim().slice(0, 8),
    p_beschreibung: beschreibung.trim().slice(0, 200),
    p_aktiv: aktiv,
  });
  if (error) return fehler(error);
  neuLaden();
  return { error: null, ok: "Kategorie gespeichert." };
}

export async function kategorienSortieren(ids: string[]): Promise<AktionsErgebnis> {
  if (!ids.every((x) => UUID.test(x))) return { error: "Ungültige Reihenfolge." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_kategorien_sortieren", { p_ids: ids });
  if (error) return fehler(error);
  neuLaden();
  return { error: null, ok: "Reihenfolge gespeichert." };
}

export async function kategorieLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Kategorie." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("treff_kategorie_loeschen", { p_id: id });
  if (error) return fehler(error);
  neuLaden();
  return { error: null, ok: "Kategorie gelöscht." };
}
