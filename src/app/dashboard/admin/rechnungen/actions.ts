"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Weitere Aufbewahrung (z. B. laufende Pruefung) sperrt die automatische Anonymisierung nach Fristablauf
export async function aufbewahrungSperren(rechnungId: string, gesperrt: boolean, grund: string): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rechnung_aufbewahrung_sperren", { p_rechnung: rechnungId, p_gesperrt: gesperrt, p_grund: grund.slice(0, 300) });
  if (error) return { error: error.code === "P0001" && error.message ? error.message : freundlicherFehler(error) };
  revalidatePath("/dashboard/admin/rechnungen");
  return { error: null, ok: gesperrt ? "Anonymisierung gesperrt." : "Sperre aufgehoben." };
}

// Rechnung erneut an die hinterlegte Adresse senden (mit PDF im Anhang). Rechte, Empfaenger und Ratenbegrenzung
// (3 pro Rechnung und Tag) prueft die Edge Function rechnung-versenden.
export async function rechnungErneutSenden(rechnungId: string): Promise<AktionsErgebnis> {
  if (!/^[0-9a-f-]{36}$/i.test(rechnungId)) return { error: "Ungültige Rechnung." };
  const supabase = await createClient();
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) return { error: "Kein Zugriff." };
  const { data, error } = await supabase.functions.invoke("rechnung-versenden", { body: { rechnung_id: rechnungId } });
  if (error) {
    let meldung = "Die Rechnung konnte gerade nicht gesendet werden. Bitte versuche es später erneut.";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const antwort = await (error as any).context?.json?.();
      if (typeof antwort?.error === "string") meldung = antwort.error;
    } catch {
      /* neutrale Meldung */
    }
    return { error: meldung };
  }
  revalidatePath("/dashboard/admin/rechnungen");
  return { error: null, ok: `Rechnung ${(data as { nummer?: string })?.nummer ?? ""} wurde erneut gesendet.` };
}

// Vereinslizenz per Ueberweisung: Zahlungseingang bestaetigen -> Lizenz 1 Jahr aktiv + Rechnung wird erstellt und versendet
export async function ueberweisungBestaetigen(id: string): Promise<AktionsErgebnis> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Ungültige Zahlungsaufforderung." };
  const supabase = await createClient();
  const { data: rechnungId, error } = await supabase.rpc("admin_ueberweisung_bestaetigen", { p_id: id });
  if (error || !rechnungId) return { error: error?.code === "P0001" || error?.code === "42501" ? error.message : freundlicherFehler(error) };
  const { error: mailFehler } = await supabase.functions.invoke("rechnung-versenden", { body: { rechnung_id: rechnungId } });
  revalidatePath("/dashboard/admin/rechnungen");
  return mailFehler
    ? { error: null, ok: "Zahlung verbucht, Lizenz freigeschaltet. Die Rechnung ist erstellt – der E-Mail-Versand hat nicht geklappt, bitte unten erneut senden." }
    : { error: null, ok: "Zahlung verbucht, Lizenz freigeschaltet und Rechnung versendet." };
}

export async function ueberweisungStornieren(id: string): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_ueberweisung_stornieren", { p_id: id });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : freundlicherFehler(error) };
  revalidatePath("/dashboard/admin/rechnungen");
  return { error: null, ok: "Zahlungsaufforderung storniert." };
}
