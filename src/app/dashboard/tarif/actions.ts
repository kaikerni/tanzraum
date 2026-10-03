"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { LEISTUNGSBEGINN_TEXT, LEISTUNGSBEGINN_VERSION } from "@/lib/recht/leistungsbeginn";

// ---------------- Verein gruenden ----------------
// Ein Verein entsteht nur zusammen mit der Vereinslizenz: hier wird nur die Bestellung (Name, Kuerzel) gespeichert.
// Verein, Lizenz und Vereinsadmin legt die Datenbank erst nach bestaetigter Zahlung an (vereinsgruendung_abschliessen).
const nutzerFehler = (error: { code?: string; message: string } | null, neutral: string) =>
  error?.code === "P0001" || error?.code === "42501" ? error.message : neutral;

export async function vereinsgruendungVorbereiten(name: string, kuerzel: string): Promise<AktionsErgebnis> {
  const n = name.trim();
  if (n.length < 2 || n.length > 120) return { error: "Bitte gib den Namen deines Vereins an (2 bis 120 Zeichen)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("vereinsgruendung_vorbereiten", { p_name: n, p_kuerzel: kuerzel.trim().slice(0, 20) || null });
  if (error) return { error: nutzerFehler(error, "Das hat gerade nicht geklappt. Bitte versuche es später erneut.") };
  return { error: null };
}

export async function vereinsgruendungAbbrechen(): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("vereinsgruendung_abbrechen");
  if (error) return { error: nutzerFehler(error, "Das hat gerade nicht geklappt.") };
  revalidatePath("/dashboard/tarif");
  return { error: null, ok: "Die Vereinsgründung wurde zurückgenommen." };
}

// ---------------- Vereinslizenz per Ueberweisung ----------------
// Beantragen legt Abo (pending) + Zahlungsaufforderung an (DB prueft Vereinsadmin, Lizenz, Bankverbindung) und
// verschickt die Aufforderung mit Bankverbindung und PDF. Freigeschaltet wird erst nach bestaetigtem Zahlungseingang.
async function fehlerAusFunktion(error: unknown, neutral: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const antwort = await (error as any).context?.json?.();
    if (typeof antwort?.error === "string") return antwort.error;
  } catch {
    /* neutral */
  }
  return neutral;
}

// vereinId null = Vereinsgruendung (Bestellung vorher mit vereinsgruendungVorbereiten gespeichert)
export async function ueberweisungBeantragen(vereinId: string | null, leistungsbeginn: boolean): Promise<AktionsErgebnis> {
  if (!leistungsbeginn) return { error: "Bitte bestätige zuerst, dass TanzRaum vor Ablauf der Widerrufsfrist mit der Leistung beginnen soll." };
  if (vereinId !== null && !/^[0-9a-f-]{36}$/i.test(vereinId)) return { error: "Bitte wähle den Verein aus." };
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("ueberweisung_beantragen", {
    p_verein_id: vereinId,
    p_leistungsbeginn_version: LEISTUNGSBEGINN_VERSION,
    p_leistungsbeginn_text: LEISTUNGSBEGINN_TEXT,
  });
  if (error || !id) return { error: error?.code === "P0001" || error?.code === "42501" ? error.message : "Das hat gerade nicht geklappt. Bitte versuche es später erneut." };
  const { error: mailFehler } = await supabase.functions.invoke("zahlungsaufforderung", { body: { aufforderung_id: id, aktion: "senden" } });
  revalidatePath("/dashboard/tarif");
  if (mailFehler) return { error: null, ok: "Überweisung beauftragt. Die Bankverbindung steht oben – die E-Mail konnte gerade nicht versendet werden." };
  return { error: null, ok: "Überweisung beauftragt. Die Zahlungsaufforderung mit Bankverbindung ist per E-Mail unterwegs." };
}

export async function ueberweisungZurueckziehen(id: string): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("ueberweisung_zurueckziehen", { p_id: id });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : "Das hat gerade nicht geklappt." };
  revalidatePath("/dashboard/tarif");
  return { error: null, ok: "Die Überweisung wurde zurückgezogen." };
}

export async function aufforderungErneutSenden(id: string): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.functions.invoke("zahlungsaufforderung", { body: { aufforderung_id: id, aktion: "senden" } });
  if (error) return { error: await fehlerAusFunktion(error, "Die E-Mail konnte gerade nicht versendet werden.") };
  revalidatePath("/dashboard/tarif");
  return { error: null, ok: "Die Zahlungsaufforderung wurde erneut gesendet." };
}
