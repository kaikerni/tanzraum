"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { MUSIK_ARTEN, MUSIK_BUCKET, type MusikArt } from "@/lib/musik";

// Rechte und Speichergrenzen prueft die Datenbank (musik_upload_vorbereiten/-abschliessen, RLS).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PFAD = "/dashboard/musik";

function fehler(e: { code?: string; message?: string } | null): string {
  if (e && (e.code === "P0001" || e.code === "42501") && e.message && !e.message.startsWith("new row")) return e.message;
  if (e?.code === "42501") return "Dafür fehlt dir die Berechtigung.";
  return freundlicherFehler(e);
}

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=${PFAD}`);
  return supabase;
}

const art = (a: string): MusikArt => (MUSIK_ARTEN.includes(a as MusikArt) ? (a as MusikArt) : "training");
const gruppenListe = (g: string[]) => [...new Set(g.filter((x) => UUID.test(x)))].slice(0, 50);

export async function musikVorbereiten(
  vereinId: string | null,
  titel: string,
  name: string,
  groesse: number,
  mime: string,
  interpret: string,
  musikArt: string,
  gruppen: string[],
): Promise<{ error: string } | { id: string; pfad: string }> {
  if (vereinId !== null && !UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  const supabase = await sitzung();
  const { data, error } = await supabase.rpc("musik_upload_vorbereiten", {
    p_verein_id: vereinId,
    p_titel: String(titel ?? "").slice(0, 120),
    p_name: String(name ?? "").slice(0, 160),
    p_groesse: Math.floor(Number(groesse) || 0),
    p_mime: String(mime ?? "").slice(0, 80),
    p_interpret: String(interpret ?? "").slice(0, 120),
    p_art: art(musikArt),
    p_gruppen: vereinId ? gruppenListe(gruppen ?? []) : [],
  });
  if (error || !data) return { error: fehler(error) };
  const d = data as { id: string; pfad: string };
  return { id: d.id, pfad: d.pfad };
}

export async function musikAbschliessen(id: string): Promise<{ error: string | null }> {
  if (!UUID.test(id)) return { error: "Upload nicht gefunden." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("musik_upload_abschliessen", { p_id: id });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD);
  return { error: null };
}

export async function musikSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const titel = String(fd.get("titel") ?? "").trim().slice(0, 120);
  if (!titel) return { error: "Bitte einen Titel angeben." };
  const bpm = Math.round(Number(fd.get("bpm") ?? ""));
  const supabase = await sitzung();
  const werte: Record<string, unknown> = {
    titel,
    interpret: String(fd.get("interpret") ?? "").trim().slice(0, 120) || null,
    art: art(String(fd.get("art") ?? "")),
    bpm: bpm >= 20 && bpm <= 300 ? bpm : null,
    notiz: String(fd.get("notiz") ?? "").trim().slice(0, 500) || null,
  };
  if (fd.get("verein") === "1") werte.gruppen = gruppenListe(fd.getAll("gruppen").map(String));
  const { data, error } = await supabase.from("musik_titel").update(werte).eq("id", id).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  revalidatePath(PFAD);
  return { error: null, ok: "Gespeichert." };
}

export async function musikLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await sitzung();
  const { data: t } = await supabase.from("musik_titel").select("datei_pfad").eq("id", id).maybeSingle();
  if (!t) return { error: "Titel nicht gefunden." };
  const { data, error } = await supabase.from("musik_titel").delete().eq("id", id).select("id");
  if (error) return { error: fehler(error) };
  if (!data?.length) return { error: "Dafür fehlt dir die Berechtigung." };
  // Datei danach entfernen (Richtlinie erlaubt Verwaltung bzw. Besitzer auch fuer verwaiste Dateien)
  await supabase.storage.from(MUSIK_BUCKET).remove([t.datei_pfad]);
  revalidatePath(PFAD);
  return { error: null, ok: "Gelöscht." };
}
