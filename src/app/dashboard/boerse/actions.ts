"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import { ortFinden, ortssucheEingerichtet } from "@/lib/geo/geocode";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Alle Rechte (Jugendschutz, Sperren, eigene Angebote, Moderation) prueft die Datenbank.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PFAD = "/dashboard/boerse";

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=${PFAD}`);
  return { supabase, userId: user.id };
}

function fehler(e: { code?: string; message?: string }): string {
  if ((e.code === "P0001" || e.code === "42501") && e.message) return e.message;
  return freundlicherFehler(e);
}

export type AngebotEingabe = {
  art: string;
  kategorie: string;
  unterkategorie: string;
  titel: string;
  beschreibung: string;
  preis: string; // "120" oder "120,50"
  preis_vb: boolean;
  zustand: string;
  groesse: string;
  ort: string;
  versand: boolean;
  abholung: boolean;
  tausch_moeglich: boolean;
  bilder: string[];
};

// Nur Ortsname/Region speichern (keine PLZ, keine Strasse); Ortsmitte fuer „in meiner Naehe“
async function ortAufbereiten(eingabe: string): Promise<{ ort: string; lat: number | null; lng: number | null }> {
  const roh = eingabe.trim().slice(0, 80);
  if (!roh) return { ort: "", lat: null, lng: null };
  if (ortssucheEingerichtet()) {
    const t = await ortFinden(roh);
    if (t) return { ort: t.ort.replace(/^\d{4,5}\s+/, ""), lat: t.lat, lng: t.lng };
  }
  // ohne Ortssuche: Hausnummern/Strassen grob entfernen, nur den Ortsteil behalten
  return { ort: roh.replace(/\d{4,5}/g, "").replace(/.*,/, "").trim() || roh, lat: null, lng: null };
}

export async function angebotSpeichern(id: string, e: AngebotEingabe): Promise<AktionsErgebnis & { id?: string }> {
  if (!UUID.test(id)) return { error: "Ungültiges Angebot." };
  const { supabase } = await sitzung();
  const preis = e.preis.trim() ? Math.round(Number(e.preis.replace(/\./g, "").replace(",", ".")) * 100) : null;
  if (preis !== null && (!Number.isFinite(preis) || preis < 0)) return { error: "Bitte gib einen gültigen Preis an." };
  const ort = await ortAufbereiten(e.ort);
  const { error } = await supabase.rpc("boerse_angebot_speichern", {
    p_id: id,
    p: {
      art: e.art,
      kategorie: e.kategorie,
      unterkategorie: e.unterkategorie || null,
      titel: e.titel,
      beschreibung: e.beschreibung,
      preis_cent: preis,
      preis_vb: e.preis_vb,
      zustand: e.zustand || null,
      groesse: e.groesse,
      ort: ort.ort,
      lat: ort.lat,
      lng: ort.lng,
      versand: e.versand,
      abholung: e.abholung,
      tausch_moeglich: e.tausch_moeglich,
      bilder: e.bilder,
    },
  });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD, "layout");
  return { error: null, ok: "Gespeichert.", id };
}

// Nicht mehr verwendete Bilder eines eigenen Angebots entfernen (Storage-RLS: nur eigener Ordner)
export async function bilderEntfernen(pfade: string[]): Promise<void> {
  const { supabase, userId } = await sitzung();
  const eigene = pfade.filter((p) => p.startsWith(`${userId}/`));
  if (eigene.length) await supabase.storage.from("boerse").remove(eigene);
}

export async function statusSetzen(id: string, status: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiges Angebot." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("boerse_status_setzen", { p_id: id, p_status: status });
  if (error) return { error: fehler(error) };
  revalidatePath(PFAD, "layout");
  return { error: null, ok: "Status gespeichert." };
}

export async function angebotLoeschen(id: string, zurueck = true): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiges Angebot." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("boerse_angebot_loeschen", { p_id: id });
  if (error) return { error: fehler(error) };
  const pfade = (data ?? []) as string[];
  if (pfade.length) await supabase.storage.from("boerse").remove(pfade);
  revalidatePath(PFAD, "layout");
  if (zurueck) redirect(`${PFAD}/meine`);
  return { error: null, ok: "Angebot gelöscht." };
}

export async function favoritSetzen(id: string, an: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiges Angebot." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("boerse_favorit_setzen", { p_id: id, p_an: an });
  if (error) return { error: fehler(error) };
  revalidatePath(`${PFAD}/meine`);
  return { error: null, ok: an ? "Zu deinen Favoriten hinzugefügt." : "Aus den Favoriten entfernt." };
}

export async function angebotMelden(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return { error: "Ungültiges Angebot." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("boerse_melden", { p_id: id, p_grund: String(fd.get("grund") ?? ""), p_text: String(fd.get("text") ?? "") });
  if (error) return { error: fehler(error) };
  return { error: null, ok: "Danke! Die Moderation schaut sich das Angebot an." };
}

// „Anbieter kontaktieren“: oeffnet den TanzRaum-Chat (bestehende Chat-, Jugendschutz- und Datenschutzregeln)
export async function anbieterKontaktieren(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiges Angebot." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("boerse_kontaktieren", { p_id: id });
  if (error || !data) return { error: error ? fehler(error) : "Das hat gerade nicht geklappt." };
  redirect(`/dashboard/nachrichten/${data}`);
}

// ---------------- Moderation (Plattform-Administration; Pruefung in der Datenbank) ----------------
export async function moderationEntscheiden(id: string, aktion: "sperren" | "freigeben", grund: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültiges Angebot." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("admin_boerse_entscheiden", { p_angebot_id: id, p_aktion: aktion, p_grund: grund || null });
  if (error) return { error: fehler(error) };
  revalidatePath("/dashboard/admin/boerse");
  return { error: null, ok: aktion === "sperren" ? "Angebot deaktiviert – die anbietende Person wurde benachrichtigt." : "Meldungen verworfen." };
}

export async function moderationLoeschen(id: string): Promise<AktionsErgebnis> {
  const r = await angebotLoeschen(id, false);
  revalidatePath("/dashboard/admin/boerse");
  return r;
}

export async function moderationSperre(userId: string, grund: string, tage: number | null): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("admin_boerse_sperre", { p_user_id: userId, p_grund: grund, p_tage: tage });
  if (error) return { error: fehler(error) };
  revalidatePath("/dashboard/admin/boerse");
  return { error: null, ok: tage === null ? "Börsen-Sperre aufgehoben." : "Person für die Börse eingeschränkt." };
}
