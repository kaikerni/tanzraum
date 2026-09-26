"use server";

import { revalidatePath } from "next/cache";
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
