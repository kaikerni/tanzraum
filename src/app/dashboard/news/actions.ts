"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Alle Rechte prueft die Datenbank (darf_news_verfassen, ziele_pruefen, darf_news_verwalten, RLS).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/news");
  return supabase;
}

function fehler(e: { code?: string; message?: string }): string {
  if ((e.code === "P0001" || e.code === "42501") && e.message) return e.message;
  return freundlicherFehler(e);
}

function neuLaden() {
  revalidatePath("/dashboard/news");
  revalidatePath("/dashboard", "layout");
}

function zieleAusForm(fd: FormData): unknown[] {
  const ziele: unknown[] = [];
  if (fd.get("ziel_verein") === "on") ziele.push({ art: "verein" });
  for (const id of fd.getAll("ziel_gruppe")) if (UUID.test(String(id))) ziele.push({ art: "gruppe", id: String(id) });
  for (const id of fd.getAll("ziel_eltern_gruppe")) if (UUID.test(String(id))) ziele.push({ art: "eltern_gruppe", id: String(id) });
  for (const r of fd.getAll("ziel_rolle")) ziele.push({ art: "rolle", rolle: String(r) });
  return ziele;
}

export async function newsVeroeffentlichen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(fd.get("verein_id") ?? "");
  if (!UUID.test(vereinId)) return { error: "Bitte einen Verein wählen." };
  const ziele = zieleAusForm(fd);
  if (ziele.length === 0) return { error: "Bitte mindestens eine Zielgruppe wählen." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("news_veroeffentlichen", {
    p_verein: vereinId,
    p_titel: String(fd.get("titel") ?? "").slice(0, 150),
    p_text: String(fd.get("text") ?? "").slice(0, 5000),
    p_wichtig: fd.get("wichtig") === "on",
    p_push: fd.get("push") === "on",
    p_ziele: ziele,
  });
  if (error) return { error: fehler(error) };
  neuLaden();
  return { error: null, ok: "Veröffentlicht." };
}

export async function newsLoeschen(newsId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(newsId)) return { error: "Ungültige News." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("news_loeschen", { p_news: newsId });
  if (error) return { error: fehler(error) };
  neuLaden();
  return { error: null, ok: "Gelöscht." };
}

export async function newsGelesen(ids: string[]): Promise<AktionsErgebnis> {
  const gueltig = ids.filter((i) => UUID.test(i)).slice(0, 200);
  if (gueltig.length === 0) return { error: null };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("news_gelesen", { p_news: gueltig });
  if (error) return { error: fehler(error) };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: "Gelesen." };
}

export async function newsLesestatus(newsId: string): Promise<{ error: string | null; liste?: { name: string; gelesenAm: string | null }[] }> {
  if (!UUID.test(newsId)) return { error: "Ungültige News." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("news_lesestatus", { p_news: newsId });
  if (error) return { error: fehler(error) };
  return { error: null, liste: ((data ?? []) as { name: string; gelesen_am: string | null }[]).map((r) => ({ name: r.name, gelesenAm: r.gelesen_am })) };
}

export async function newsRollenSetzen(vereinId: string, rollen: string[]): Promise<AktionsErgebnis> {
  if (!UUID.test(vereinId)) return { error: "Ungültiger Verein." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("news_rollen_setzen", { p_verein: vereinId, p_rollen: rollen.filter((r) => ["trainer", "betreuer"].includes(r)) });
  if (error) return { error: fehler(error) };
  neuLaden();
  return { error: null, ok: "Gespeichert." };
}

export async function umfrageErstellen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(fd.get("verein_id") ?? "");
  if (!UUID.test(vereinId)) return { error: "Bitte einen Verein wählen." };
  const ziele = zieleAusForm(fd);
  if (ziele.length === 0) return { error: "Bitte mindestens eine Zielgruppe wählen." };
  const optionen = fd.getAll("option").map((o) => String(o).trim()).filter(Boolean).slice(0, 10);
  const ende = String(fd.get("endet_am") ?? "");
  const endeDatum = new Date(ende);
  if (!ende || Number.isNaN(endeDatum.getTime())) return { error: "Bitte ein Ende angeben." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("vereinsumfrage_erstellen", {
    p_verein: vereinId,
    p_frage: String(fd.get("frage") ?? "").slice(0, 300),
    p_beschreibung: String(fd.get("beschreibung") ?? "").slice(0, 2000),
    p_optionen: optionen,
    p_mehrfach: fd.get("mehrfach") === "on",
    p_anonym: fd.get("anonym") === "on",
    p_endet_am: endeDatum.toISOString(),
    p_ziele: ziele,
  });
  if (error) return { error: fehler(error) };
  neuLaden();
  return { error: null, ok: "Umfrage gestartet." };
}

export async function umfrageAbstimmen(umfrageId: string, optionen: number[]): Promise<AktionsErgebnis> {
  if (!UUID.test(umfrageId)) return { error: "Ungültige Umfrage." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("vereinsumfrage_abstimmen", { p_umfrage: umfrageId, p_optionen: optionen.filter((o) => Number.isInteger(o)) });
  if (error) return { error: fehler(error) };
  revalidatePath("/dashboard/news");
  return { error: null, ok: optionen.length ? "Abgestimmt." : "Stimme zurückgenommen." };
}

export async function umfrageBeenden(umfrageId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(umfrageId)) return { error: "Ungültige Umfrage." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("vereinsumfrage_beenden", { p_umfrage: umfrageId });
  if (error) return { error: fehler(error) };
  neuLaden();
  return { error: null, ok: "Umfrage beendet." };
}

export async function umfrageLoeschen(umfrageId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(umfrageId)) return { error: "Ungültige Umfrage." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("vereinsumfrage_loeschen", { p_umfrage: umfrageId });
  if (error) return { error: fehler(error) };
  neuLaden();
  return { error: null, ok: "Gelöscht." };
}

export async function ankuendigungGelesen(ids: string[]): Promise<AktionsErgebnis> {
  const gueltig = ids.filter((i) => UUID.test(i)).slice(0, 50);
  if (gueltig.length === 0) return { error: null };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("ankuendigung_gelesen", { p_ids: gueltig });
  if (error) return { error: fehler(error) };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: "Gelesen." };
}
