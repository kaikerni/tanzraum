"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Globale Nutzer-Navigation je Tarif – nur Anzeige; die Datenbank prueft das Admin-Recht und protokolliert.
export async function navigationTarifeSpeichern(einstellung: Record<string, string[]>): Promise<AktionsErgebnis> {
  const sauber: Record<string, string[]> = {};
  for (const [href, tarife] of Object.entries(einstellung)) {
    if (!/^\/[a-z0-9/#_-]{1,80}$/.test(href) || !Array.isArray(tarife)) continue;
    sauber[href] = tarife.filter((t) => t === "free" || t === "basic" || t === "verein");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_navigation_tarife_setzen", { p_einstellung: sauber });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: "Navigation gespeichert. Zugriffsrechte bleiben unverändert – jede Seite prüft weiterhin selbst." };
}
