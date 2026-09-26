"use client";

import { createClient } from "@/lib/supabase/client";

const NEUTRAL = "Das hat gerade nicht geklappt. Bitte versuche es später erneut.";

// Ruft eine Zahlungs-Edge-Function auf. Fehlertexte kommen nur aus unseren eigenen Funktionen
// (dort bereits neutral formuliert) -- Anbieterfehler werden nie ungefiltert angezeigt.
export async function zahlungAufruf<T>(funktion: "zahlung-starten" | "abo-verwalten", body: Record<string, unknown>): Promise<{ daten?: T; fehler?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke(funktion, { body });
  if (!error) return { daten: data as T };
  try {
    // deno-lint-ignore no-explicit-any
    const antwort = (error as any).context as Response | undefined;
    const json = antwort ? await antwort.json() : null;
    if (json && typeof json.error === "string" && json.error.length < 200) return { fehler: json.error };
  } catch {
    /* neutral */
  }
  return { fehler: NEUTRAL };
}
