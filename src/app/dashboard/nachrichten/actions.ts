"use server";

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

export async function dmStarten(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("chat_dm_starten", { p_user_id: userId });
  if (error || !data) return { error: error ? freundlicherFehler(error) : "Der Chat konnte nicht geöffnet werden." };
  redirect(`/dashboard/nachrichten/${data}`);
}

export async function gruppenchatAnlegen(typ: string, vereinId: string, gruppeId: string | null): Promise<AktionsErgebnis> {
  if (!UUID.test(vereinId) || (gruppeId !== null && !UUID.test(gruppeId))) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("chat_anlegen", { p_typ: typ, p_verein_id: vereinId, p_gruppe_id: gruppeId });
  if (error || !data) return { error: error ? freundlicherFehler(error) : "Der Chat konnte nicht angelegt werden." };
  revalidatePath("/dashboard/nachrichten", "layout");
  redirect(`/dashboard/nachrichten/${data}`);
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
  const { data: bild, error } = await supabase.rpc("nachricht_loeschen", { p_nachricht_id: nachrichtId });
  if (error) return { error: freundlicherFehler(error) };
  if (bild) await supabase.storage.from("chat-bilder").remove([bild as string]);
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

export async function verbindungAnfragen(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("verbindung_anfragen", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten/neu");
  return { error: null, ok: data === "verbunden" ? "Ihr seid jetzt verbunden." : "Anfrage gesendet." };
}

export async function verbindungBeantworten(userId: string, annehmen: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("verbindung_beantworten", { p_user_id: userId, p_annehmen: annehmen });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten/neu");
  return { error: null, ok: annehmen ? "Verbunden." : "Anfrage abgelehnt." };
}

export async function verbindungEntfernen(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("verbindung_entfernen", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten/neu");
  return { error: null, ok: "Verbindung entfernt." };
}

export async function chatFreigabeSetzen(kindUserId: string, erteilt: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(kindUserId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("chat_einwilligung_setzen", { p_kind_user_id: kindUserId, p_erteilt: erteilt });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/nachrichten", "layout");
  return { error: null, ok: erteilt ? "Chat freigeschaltet." : "Chat-Freigabe widerrufen." };
}
