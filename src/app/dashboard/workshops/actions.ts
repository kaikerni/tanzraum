"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import { geocode } from "@/lib/geo/geocode";
import { BUNDESLAENDER } from "@/lib/workshops/workshops";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// 🎓 Workshops: Rechte (ab 16 einreichen, zentrale Freigabe durch Admin/Team) prueft die Datenbank.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WorkshopEingabe = {
  titel: string;
  datum: string;
  datum_bis: string;
  uhrzeit_von: string;
  uhrzeit_bis: string;
  ausrichter: string;
  ort: string;
  adresse: string;
  bundesland: string;
  kategorie: string;
  beschreibung: string;
  ansprechpartner: string;
  kontakt: string;
  link: string;
  bild_pfad: string | null;
};

function pruefen(e: WorkshopEingabe): string | null {
  if (e.titel.trim().length < 3) return "Bitte einen Workshopnamen angeben.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.datum)) return "Bitte ein Datum angeben.";
  if (e.datum_bis && (!/^\d{4}-\d{2}-\d{2}$/.test(e.datum_bis) || e.datum_bis < e.datum)) return "Das Enddatum muss nach dem Beginn liegen.";
  if (e.ausrichter.trim().length < 2) return "Bitte den Ausrichter angeben.";
  if (e.ort.trim().length < 2) return "Bitte den Ort angeben.";
  if (!(BUNDESLAENDER as readonly string[]).includes(e.bundesland)) return "Bitte das Bundesland auswählen.";
  if (e.beschreibung.trim().length < 10) return "Bitte beschreibe den Workshop (mindestens 10 Zeichen).";
  if (e.link.trim() && !/^https?:\/\/\S+$/.test(e.link.trim())) return "Der Link muss mit https:// beginnen.";
  return null;
}

// Ort in Koordinaten umrechnen (nur Veranstaltungsort, ueber den Server; ohne Schluessel: keine Karte, nur Link)
async function koordinaten(e: WorkshopEingabe): Promise<{ lat: number | null; lng: number | null }> {
  const p = await geocode(`${e.adresse.trim() ? `${e.adresse.trim()}, ` : ""}${e.ort.trim()}, ${e.bundesland}, Deutschland`).catch(() => null);
  return p ? { lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 } : { lat: null, lng: null };
}

function werte(e: WorkshopEingabe, k: { lat: number | null; lng: number | null }) {
  return {
    titel: e.titel.trim().slice(0, 140),
    datum: e.datum,
    datum_bis: e.datum_bis || null,
    uhrzeit_von: e.uhrzeit_von || null,
    uhrzeit_bis: e.uhrzeit_bis || null,
    ausrichter: e.ausrichter.trim().slice(0, 140),
    ort: e.ort.trim().slice(0, 140),
    adresse: e.adresse.trim().slice(0, 200),
    bundesland: e.bundesland,
    kategorie: e.kategorie || null,
    beschreibung: e.beschreibung.trim().slice(0, 5000),
    ansprechpartner: e.ansprechpartner.trim().slice(0, 140),
    kontakt: e.kontakt.trim().slice(0, 200),
    link: e.link.trim().slice(0, 500),
    bild_pfad: e.bild_pfad,
    lat: k.lat,
    lng: k.lng,
  };
}

export async function workshopEinreichen(e: WorkshopEingabe, entwurf: boolean, direktFreigeben: boolean): Promise<AktionsErgebnis & { id?: string }> {
  const fehler = pruefen(e);
  if (fehler) return { error: fehler };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("workshop_einreichen", { p: werte(e, await koordinaten(e)), p_entwurf: entwurf, p_direkt_freigeben: direktFreigeben });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/workshops");
  return {
    error: null,
    id: data as string,
    ok: direktFreigeben ? "Workshop veröffentlicht." : entwurf ? "Als Entwurf gespeichert." : "Danke! Dein Workshop wurde eingereicht und wird vom TanzRaum-Team geprüft.",
  };
}

export async function workshopBearbeiten(id: string, e: WorkshopEingabe, entwurf: boolean): Promise<AktionsErgebnis & { id?: string }> {
  if (!UUID.test(id)) return { error: "Ungültiger Workshop." };
  const fehler = pruefen(e);
  if (fehler) return { error: fehler };
  const supabase = await createClient();
  const { error } = await supabase.rpc("workshop_bearbeiten", { p_id: id, p: werte(e, await koordinaten(e)), p_entwurf: entwurf });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/workshops");
  revalidatePath(`/dashboard/workshops/${id}`);
  return { error: null, id, ok: "Gespeichert." };
}

export async function workshopStatus(id: string, status: "freigegeben" | "abgelehnt" | "archiviert" | "entwurf", grund?: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiger Workshop." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("workshop_status_setzen", { p_id: id, p_status: status, p_grund: grund ?? null });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/workshops");
  revalidatePath(`/dashboard/workshops/${id}`);
  revalidatePath("/dashboard/workshops/pruefen");
  const text: Record<string, string> = {
    freigegeben: "Freigegeben – der Workshop ist jetzt für alle angemeldeten Nutzer sichtbar.",
    abgelehnt: "Abgelehnt – die einreichende Person wurde benachrichtigt.",
    archiviert: "Archiviert.",
    entwurf: "Zurückgezogen – der Workshop ist wieder ein Entwurf.",
  };
  return { error: null, ok: text[status] };
}

export async function workshopLoeschen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiger Workshop." };
  const supabase = await createClient();
  const { data: bild, error } = await supabase.rpc("workshop_loeschen", { p_id: id });
  if (error) return { error: freundlicherFehler(error) };
  if (typeof bild === "string" && bild) await supabase.storage.from("workshops").remove([bild]);
  revalidatePath("/dashboard/workshops");
  return { error: null, ok: "Workshop gelöscht." };
}
