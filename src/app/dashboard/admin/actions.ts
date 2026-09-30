"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ANSICHT_COOKIE, istAnsicht } from "@/lib/admin/ansicht";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rechte prueft die Datenbank (nur Plattform-Administration)
export async function meldungBearbeiten(id: string, notiz: string, spotlightEntfernen: boolean, kontoSperren: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("meldung_bearbeiten", {
    p_id: id,
    p_notiz: notiz.slice(0, 2000),
    p_spotlight_entfernen: spotlightEntfernen,
    p_konto_sperren: kontoSperren,
  });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/admin/meldungen");
  return { error: null, ok: "Meldung erledigt." };
}

// Spotlights plattformweit an/aus und fuer welche Tarife sichtbar (Pruefung in der Datenbank: nur Plattform-Administration)
export async function spotlightsEinstellen(aktiv: boolean, tarife: string[]): Promise<AktionsErgebnis> {
  const erlaubt = tarife.filter((t) => ["free", "basic", "verein"].includes(t));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_spotlights_setzen", { p_aktiv: aktiv, p_tarife: erlaubt });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: aktiv ? "Spotlights sind eingeschaltet." : "Spotlights sind für alle ausgeschaltet." };
}

// „Ansicht als …“: nur fuer die Plattform-Administration; reine Darstellung (Cookie), keine Rechte
export async function ansichtWaehlen(ansicht: string | null): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) return { error: "Nur für die TanzRaum-Administration." };
  const speicher = await cookies();
  if (ansicht === null) speicher.delete(ANSICHT_COOKIE);
  else if (istAnsicht(ansicht)) speicher.set(ANSICHT_COOKIE, ansicht, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  else return { error: "Unbekannte Ansicht." };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: ansicht ? "Ansicht gewechselt." : "Vorschau beendet." };
}

// Musikbereich plattformweit an/aus (Pruefung in der Datenbank: nur Plattform-Administration)
export async function musikEinstellen(aktiv: boolean): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_musik_setzen", { p_aktiv: aktiv === true });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: aktiv ? "Musikbereich ist eingeschaltet." : "Musikbereich ist für alle ausgeschaltet." };
}
