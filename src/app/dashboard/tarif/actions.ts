"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { LEISTUNGSBEGINN_TEXT, LEISTUNGSBEGINN_VERSION } from "@/lib/recht/leistungsbeginn";

// Verein anlegen, um danach direkt die Vereinslizenz zu kaufen (Kauf = Lizenz fuer den eigenen Verein)
export async function vereinFuerLizenzAnlegen(_prev: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const name = String(formData.get("name") ?? "").trim();
  const kuerzel = String(formData.get("kuerzel") ?? "").trim();
  if (!name) return { error: "Bitte einen Vereinsnamen angeben." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc("verein_anlegen", { p_name: name, p_kuerzel: kuerzel || null });
  if (error || !data) return { error: error?.message ?? "Verein konnte nicht angelegt werden." };
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/tarif?verein=${data}#verein`);
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

export async function ueberweisungBeantragen(vereinId: string, leistungsbeginn: boolean): Promise<AktionsErgebnis> {
  if (!leistungsbeginn) return { error: "Bitte bestätige zuerst, dass TanzRaum vor Ablauf der Widerrufsfrist mit der Leistung beginnen soll." };
  if (!/^[0-9a-f-]{36}$/i.test(vereinId)) return { error: "Bitte wähle den Verein aus." };
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
