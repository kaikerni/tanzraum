"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import { geocode } from "@/lib/geo/geocode";
import { sperrgrundText } from "@/lib/chat/sperrgrund";
import { alsTreffer, type ListenTreffer, type NetzwerkKategorie } from "@/lib/netzwerk/tanzraumNetzwerk";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KATEGORIEN = new Set<NetzwerkKategorie>(["mitglieder", "vereine", "gruppen", "trainer"]);
const MELDEGRUENDE = new Set(["unangemessen", "belaestigung", "unerwuenschter_kontakt", "jugendgefaehrdend", "spam", "sonstiges"]);

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

export async function netzwerkSuchen(suche: string, kategorie: NetzwerkKategorie, ort: string): Promise<ListenTreffer[]> {
  if (!KATEGORIEN.has(kategorie)) return [];
  const supabase = await sitzung();
  const { data } = await supabase.rpc("netzwerk_suche", {
    p_suche: suche.slice(0, 80),
    p_kategorie: kategorie,
    p_ort: ort.slice(0, 80),
  });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map(alsTreffer);
}

// Nachricht senden: nur wenn die Datenbank es erlaubt (Verein, Eltern/Kind oder Vernetzung)
export async function nachrichtOeffnen(userId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("chat_dm_starten", { p_user_id: userId });
  if (error || !data) {
    const { data: grund } = await supabase.rpc("schreib_sperrgrund", { p_user_id: userId });
    return { error: sperrgrundText(grund as string | null) };
  }
  redirect(`/dashboard/nachrichten/${data}`);
}

export async function vernetzen(userId: string): Promise<AktionsErgebnis & { status?: string }> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("kontaktanfrage_senden", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(`/dashboard/netzwerk/person/${userId}`);
  if (data === "direkt" || data === "angenommen") return { error: null, status: "verbunden", ok: "Ihr seid bereits verbunden." };
  return { error: null, status: "angefragt", ok: "Anfrage gesendet. Sobald sie angenommen wird, seid ihr vernetzt." };
}

export async function anfrageBeantworten(userId: string, annehmen: boolean): Promise<AktionsErgebnis & { status?: string }> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("kontaktanfrage_beantworten", { p_user_id: userId, p_aktion: annehmen ? "annehmen" : "ablehnen" });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(`/dashboard/netzwerk/person/${userId}`);
  return { error: null, status: annehmen ? "verbunden" : undefined, ok: annehmen ? "Ihr seid jetzt vernetzt." : "Anfrage abgelehnt." };
}

export async function anfrageZurueckziehen(userId: string): Promise<AktionsErgebnis & { status?: string }> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("kontaktanfrage_zurueckziehen", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(`/dashboard/netzwerk/person/${userId}`);
  return { error: null, ok: "Anfrage zurückgezogen." };
}

export async function blockieren(userId: string, blockiert: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc(blockiert ? "nutzer_blockieren" : "nutzer_freigeben", { p_user_id: userId });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(`/dashboard/netzwerk/person/${userId}`);
  return { error: null, ok: blockiert ? "Person blockiert. Ihr könnt euch nicht mehr kontaktieren." : "Blockierung aufgehoben." };
}

export async function melden(ziel: { userId?: string; spotlightId?: string }, grund: string, text: string): Promise<AktionsErgebnis> {
  if ((ziel.userId && !UUID.test(ziel.userId)) || (ziel.spotlightId && !UUID.test(ziel.spotlightId))) return { error: "Ungültige Auswahl." };
  if (!MELDEGRUENDE.has(grund)) return { error: "Bitte wähle einen Grund." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("melden", {
    p_ziel_user_id: ziel.userId ?? null,
    p_spotlight_id: ziel.spotlightId ?? null,
    p_grund: grund,
    p_text: text.slice(0, 1000),
  });
  if (error) return { error: freundlicherFehler(error) };
  return { error: null, ok: "Danke! Deine Meldung ist beim TanzRaum-Team eingegangen." };
}

export async function mapEinstellungenSpeichern(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const ort = String(formData.get("ort") ?? "").trim().slice(0, 80);
  const sichtbar = formData.get("sichtbar") === "ja";
  const supabase = await sitzung();
  let lat: number | null = null;
  let lng: number | null = null;
  if (ort) {
    const position = await geocode(ort);
    if (!position) return { error: "Diesen Ort haben wir nicht gefunden. Versuche es mit PLZ und Ort, z. B. „68159 Mannheim“." };
    lat = position.lat;
    lng = position.lng;
  }
  const { error } = await supabase.rpc("map_einstellungen_setzen", { p_sichtbar: sichtbar, p_ort: ort || null, p_lat: lat, p_lng: lng });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/einstellungen");
  revalidatePath("/dashboard/netzwerk");
  return { error: null, ok: ort ? "Gespeichert." : "Ort entfernt – du wirst nicht auf der Map angezeigt." };
}
