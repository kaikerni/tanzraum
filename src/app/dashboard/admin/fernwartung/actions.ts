"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Fernwartung durch die TanzRaum-Administration: nur Konfiguration, nur waehrend einer aktiven Freigabe des Vereins.
// fernwartung_vereinsdaten_setzen prueft Freigabe und Ablauf in der Datenbank und protokolliert jede Aenderung.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FELDER = ["name", "kuerzel", "beschreibung", "email", "telefon", "webseite", "strasse", "hausnummer", "plz", "ort"] as const;

export async function fernwartungVereinsdatenSpeichern(_vorher: AktionsErgebnis, formData: FormData): Promise<AktionsErgebnis> {
  const vereinId = String(formData.get("verein_id") ?? "");
  if (!UUID.test(vereinId)) return { error: "Verein nicht gefunden." };
  const daten: Record<string, string> = {};
  for (const f of FELDER) {
    const w = formData.get(f);
    if (typeof w === "string") daten[f] = w.trim().slice(0, f === "beschreibung" ? 2000 : 200);
  }
  if (!daten.name) return { error: "Der Vereinsname darf nicht leer sein." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("fernwartung_vereinsdaten_setzen", { p_verein_id: vereinId, p_daten: daten });
  if (error) return { error: error.code === "42501" ? "Die Fernwartung ist nicht (mehr) freigegeben." : freundlicherFehler(error) };
  revalidatePath(`/dashboard/admin/fernwartung/${vereinId}`);
  return { error: null, ok: "Gespeichert und im Protokoll des Vereins vermerkt." };
}
