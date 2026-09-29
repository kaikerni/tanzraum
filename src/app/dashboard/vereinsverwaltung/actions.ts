"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import { VEREINS_MODULE } from "@/lib/navigation";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Vereinsverwaltung: Bereiche ein-/ausschalten und Fernwartung anfordern/widerrufen.
// Rechte prueft die Datenbank (verein_module_setzen, fernwartung_anfordern, fernwartung_widerrufen).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

export async function bereicheSpeichern(_vorher: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(formData.get("verein_id") ?? "");
  if (!UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  // Nicht angehakt = ausgeschaltet
  const aus = VEREINS_MODULE.map((m) => m.id).filter((id) => formData.get(`modul_${id}`) !== "an");
  const supabase = await sitzung();
  const { error } = await supabase.rpc("verein_module_setzen", { p_verein_id: vereinId, p_module_aus: aus });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: "Gespeichert. Ausgeschaltete Bereiche sind für alle Mitglieder ausgeblendet – die Daten bleiben erhalten." };
}

export async function fernwartungAnfordern(_vorher: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(formData.get("verein_id") ?? "");
  if (!UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  const typ = String(formData.get("typ") ?? "Sonstiges").slice(0, 60);
  const beschreibung = String(formData.get("beschreibung") ?? "").trim().slice(0, 1000);
  const fernzugriff = formData.get("fernzugriff") === "ja";
  if (beschreibung.length < 5) return { error: "Bitte beschreibe kurz, wobei der Support helfen soll." };
  const supabase = await sitzung();
  const { error } = await supabase.rpc("fernwartung_anfordern", {
    p_verein_id: vereinId,
    p_typ: typ,
    p_beschreibung: beschreibung,
    p_fernzugriff: fernzugriff,
  });
  if (error) return { error: error.message === "Nicht berechtigt" ? "Fernwartung können nur Vereinsadmins mit aktiver Verein-Lizenz anfordern." : freundlicherFehler(error) };
  revalidatePath("/dashboard/vereinsverwaltung/fernwartung");
  return {
    error: null,
    ok: fernzugriff
      ? "Anfrage gesendet. Der Support darf 24 Stunden lang die Einstellungen eures Vereins bearbeiten – Mitgliederdaten sieht er nicht."
      : "Anfrage gesendet. Der Support meldet sich bei euch.",
  };
}

export async function fernwartungWiderrufen(formData: FormData) {
  const id = String(formData.get("anfrage_id") ?? "");
  if (!UUID.test(id)) return;
  const supabase = await sitzung();
  await supabase.rpc("fernwartung_widerrufen", { p_anfrage_id: id });
  revalidatePath("/dashboard/vereinsverwaltung/fernwartung");
}

// Zugriff je Bereich nach Rolle (Admin hat immer Zugriff)
const ZUGANG_BEREICHE = ["fahrgemeinschaften", "kostueme", "finanzen", "statistiken"];
const ROLLEN = ["trainer", "betreuer", "mitglied", "eltern", "sonstige"];

export async function zugangSpeichern(_vorher: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(formData.get("verein_id") ?? "");
  if (!UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  const supabase = await sitzung();
  for (const bereich of ZUGANG_BEREICHE) {
    const rollen = ROLLEN.filter((r) => formData.get(`${bereich}_${r}`) === "an");
    const { error } = await supabase.rpc("verein_bereich_zugang_setzen", { p_verein_id: vereinId, p_bereich: bereich, p_rollen: rollen });
    if (error) return { error: freundlicherFehler(error) };
  }
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: "Zugriffe gespeichert." };
}

// Welche Inhalte die Vereinsstatistik zeigt
const STATISTIK_INHALTE = ["mitglieder", "rollen", "altersklassen", "gruppen", "beteiligung", "turniere"];

export async function statistikInhalteSpeichern(_vorher: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(formData.get("verein_id") ?? "");
  if (!UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  const inhalte = STATISTIK_INHALTE.filter((i) => formData.get(`inhalt_${i}`) === "an");
  const supabase = await sitzung();
  const { error } = await supabase.rpc("verein_statistik_inhalte_setzen", { p_verein_id: vereinId, p_inhalte: inhalte });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/statistiken");
  return { error: null, ok: "Statistik-Inhalte gespeichert." };
}
