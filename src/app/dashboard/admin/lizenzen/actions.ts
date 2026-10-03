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

// ---------------------------------------------------------------------------------------------
// Kostenlose Sonderfreischaltung per E-Mail-Einladung (nur TanzRaum-Admin; aktiv erst nach Annahme)
// ---------------------------------------------------------------------------------------------
export type FreischaltungEinladung = {
  id: string;
  email: string;
  nutzer: string | null;
  tarif: "basic" | "verein";
  bis: string | null;
  notiz: string | null;
  erstelltAm: string;
  gesendetAm: string | null;
  angenommen: boolean;
  angenommenAm: string | null;
  status: "ausstehend" | "aktiv" | "abgelaufen" | "widerrufen";
};

export async function freischaltungEinladungen(): Promise<FreischaltungEinladung[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_freischaltung_einladungen");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((e) => ({
    id: e.id,
    email: e.email,
    nutzer: e.nutzer ?? null,
    tarif: e.tarif,
    bis: e.bis ?? null,
    notiz: e.notiz ?? null,
    erstelltAm: e.erstellt_am,
    gesendetAm: e.gesendet_am ?? null,
    angenommen: e.angenommen === true,
    angenommenAm: e.angenommen_am ?? null,
    status: e.status,
  }));
}

async function einladungMailSenden(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<string | null> {
  const { error } = await supabase.functions.invoke("send-beitritt-einladung", { body: { freischaltung_id: id } });
  return error ? "Die E-Mail konnte gerade nicht gesendet werden." : null;
}

export async function freischaltungEinladen(_: AktionsErgebnis, form: FormData): Promise<AktionsErgebnis> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const tarif = String(form.get("tarif") ?? "");
  const laufzeit = String(form.get("laufzeit") ?? "unbegrenzt");
  const bis = laufzeit === "befristet" ? String(form.get("bis") ?? "") : "";
  const notiz = String(form.get("notiz") ?? "").slice(0, 500);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };
  if (tarif !== "basic" && tarif !== "verein") return { error: "Bitte BASIC oder VEREIN wählen." };
  if (laufzeit === "befristet" && !DATUM.test(bis)) return { error: "Bitte das Datum „Kostenlos bis“ angeben." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_freischaltung_einladen", { p_email: email, p_tarif: tarif, p_bis: bis || null, p_notiz: notiz });
  if (error) return { error: freundlicherFehler(error) };
  const id = (data as { id?: string } | null)?.id;
  const mailFehler = id ? await einladungMailSenden(supabase, id) : "Die Einladung wurde nicht angelegt.";
  revalidatePath("/dashboard/admin/lizenzen");
  if (mailFehler) return { error: `Einladung angelegt, aber: ${mailFehler} Du kannst sie in der Übersicht erneut senden.` };
  return { error: null, ok: `Einladung an ${email} gesendet. Der Zugang wird erst nach Annahme aktiviert.` };
}

export async function freischaltungEinladungErneutSenden(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Einladung." };
  const supabase = await createClient();
  const fehler = await einladungMailSenden(supabase, id);
  revalidatePath("/dashboard/admin/lizenzen");
  return fehler ? { error: fehler } : { error: null, ok: "Einladung erneut gesendet." };
}

export async function freischaltungEinladungWiderrufen(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Einladung." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_freischaltung_einladung_widerrufen", { p_id: id });
  if (error) return { error: freundlicherFehler(error) };
  neuLaden();
  return { error: null, ok: "Einladung widerrufen. Eine bereits aktive Freischaltung wurde beendet." };
}
