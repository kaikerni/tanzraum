"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Nur TanzRaum-Admin – Tarif, Art, Ablauf und Protokoll prueft/schreibt die Datenbank (admin_freischalten & Co.).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function neuLaden() {
  revalidatePath("/dashboard/admin/lizenzen");
  revalidatePath("/dashboard/admin/tarife");
  revalidatePath("/dashboard/admin/team");
}

export type LaufendeLizenz = {
  aboId: string;
  tarif: string;
  lizenzart: string;
  anbieter: string;
  status: string;
  periode: string;
  start: string;
  ablauf: string | null;
  notiz: string | null;
  verein: string | null;
};

export async function lizenzenPerson(userId: string): Promise<LaufendeLizenz[]> {
  if (!UUID.test(userId)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_lizenzen_person", { p_user_id: userId });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((l) => ({
    aboId: l.abo_id,
    tarif: l.tarif,
    lizenzart: l.lizenzart,
    anbieter: l.anbieter,
    status: l.status,
    periode: l.periode,
    start: l.start,
    ablauf: l.ablauf,
    notiz: l.notiz,
    verein: l.verein,
  }));
}

export async function freischalten(eingabe: {
  userId: string;
  tarif: "free" | "basic" | "verein";
  art: "kostenlos" | "bezahlt";
  bis: string | null;
  notiz: string;
}): Promise<AktionsErgebnis> {
  if (!UUID.test(eingabe.userId)) return { error: "Ungültige Person." };
  if (!["free", "basic", "verein"].includes(eingabe.tarif) || !["kostenlos", "bezahlt"].includes(eingabe.art)) return { error: "Ungültige Auswahl." };
  if (eingabe.bis && !DATUM.test(eingabe.bis)) return { error: "Bitte ein gültiges Datum angeben." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_freischalten", {
    p_user_id: eingabe.userId,
    p_tarif: eingabe.tarif,
    p_art: eingabe.art,
    p_bis: eingabe.tarif === "free" ? null : eingabe.bis,
    p_notiz: eingabe.notiz.slice(0, 500),
  });
  if (error) return { error: freundlicherFehler(error) };
  neuLaden();
  const tarif = String((data as { tarif?: string } | null)?.tarif ?? "").toUpperCase();
  if (eingabe.tarif === "free")
    return { error: null, ok: `Manuelle Freischaltungen beendet. Aktueller Zugang: ${tarif}${tarif !== "FREE" ? " (z. B. bezahltes Abo, Team-BASIC oder Vereinslizenz)" : ""}.` };
  return { error: null, ok: `Freigeschaltet. Aktueller Zugang: ${tarif}.` };
}

export async function freischaltungBeenden(aboId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(aboId)) return { error: "Ungültige Lizenz." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_freischaltung_beenden", { p_abo_id: aboId });
  if (error) return { error: freundlicherFehler(error) };
  neuLaden();
  return { error: null, ok: "Freischaltung deaktiviert – es gilt wieder die normale Tariflogik." };
}

export async function freischaltungVerlaengern(aboId: string, bis: string | null): Promise<AktionsErgebnis> {
  if (!UUID.test(aboId)) return { error: "Ungültige Lizenz." };
  if (bis && !DATUM.test(bis)) return { error: "Bitte ein gültiges Datum angeben." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_freischaltung_verlaengern", { p_abo_id: aboId, p_bis: bis });
  if (error) return { error: freundlicherFehler(error) };
  neuLaden();
  return { error: null, ok: bis ? `Verlängert bis ${new Date(bis).toLocaleDateString("de-DE")}.` : "Jetzt unbefristet." };
}
