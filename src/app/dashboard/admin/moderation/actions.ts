"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Alle Rechte prueft die Datenbank (TanzRaum-Admin bzw. Team mit Chat-Rechten). Hier nur Eingaben bereinigen.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PFAD = "/dashboard/admin/moderation";

export async function chatFreigabeSetzen(aktiv: boolean, tarife: string[]): Promise<AktionsErgebnis> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_chat_freigabe_setzen", {
    p_aktiv: aktiv,
    p_tarife: tarife.filter((t) => t === "free" || t === "basic" || t === "verein"),
  });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: aktiv ? "Der TanzRaum Chat ist freigeschaltet." : "Der TanzRaum Chat ist ausgeschaltet." };
}

export async function chatFallSetzen(
  id: string,
  status: string,
  notiz: string,
  aktion: { entfernen?: boolean; verwarnen?: boolean; sperreStunden?: number },
): Promise<AktionsErgebnis> {
  if (!UUID.test(id) || !["offen", "in_pruefung", "erledigt", "keine_massnahme"].includes(status)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_fall_setzen", {
    p_id: id,
    p_status: status,
    p_notiz: notiz.slice(0, 2000),
    p_nachricht_entfernen: aktion.entfernen === true,
    p_verwarnen: aktion.verwarnen === true,
    p_sperre_stunden: Math.max(0, Math.min(Math.round(aktion.sperreStunden ?? 0), 24 * 90)),
  });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Gespeichert." };
}

export async function chatSperreAufheben(id: string): Promise<AktionsErgebnis> {
  if (!UUID.test(id)) return { error: "Ungültige Auswahl." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("chat_sperre_aufheben", { p_id: id });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Sperre aufgehoben." };
}

export async function chatEinstellungenSpeichern(werte: Record<string, number>): Promise<AktionsErgebnis> {
  const sauber: Record<string, number> = {};
  for (const [k, v] of Object.entries(werte)) if (/^[a-z_0-9]{3,40}$/.test(k) && Number.isInteger(v)) sauber[k] = v;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_chat_einstellungen_setzen", { p: sauber });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath(PFAD);
  return { error: null, ok: "Schwellenwerte gespeichert." };
}
