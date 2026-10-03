"use server";

import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Annahme einer kostenlosen Sonderfreischaltung: Pruefung (angemeldet, eingeladene und bestaetigte E-Mail, einmalig,
// gueltig) und Aktivierung erfolgen ausschliesslich in der Datenbank (freischaltung_einladung_annehmen).
export async function freischaltungAnnehmen(_: AktionsErgebnis, form: FormData): Promise<AktionsErgebnis> {
  const token = String(form.get("token") ?? "");
  if (!UUID.test(token)) return { error: "Einladungslink ungültig." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("freischaltung_einladung_annehmen", { p_token: token });
  if (error) return { error: freundlicherFehler(error) };
  // bewusst kein revalidatePath: die Seite soll die Erfolgsmeldung zeigen (nicht „bereits angenommen“);
  // „Mein Tarif“ und das Dashboard laden ihre Daten ohnehin bei jedem Aufruf neu
  const zugang = String((data as { zugang?: string } | null)?.zugang ?? "").toUpperCase();
  return { error: null, ok: `Geschafft! Dein kostenloser ${zugang}-Zugang ist jetzt aktiv.` };
}
