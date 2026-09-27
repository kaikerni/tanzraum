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
