"use server";

import { createClient } from "@/lib/supabase/server";

// Widerruf der Kontoloeschung per Link (ohne Anmeldung); Pruefung des Tokens in der Datenbank
export type WiderrufStand = { error: string | null; ok: boolean };

export async function loeschungWiderrufen(_prev: WiderrufStand, fd: FormData): Promise<WiderrufStand> {
  const token = String(fd.get("token") ?? "");
  if (!token || token.length > 200) return { error: "Dieser Link ist ungültig oder abgelaufen.", ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("konto_loeschung_widerrufen", { p_token: token });
  if (error) return { error: error.code === "P0001" && error.message ? error.message : "Das hat gerade nicht geklappt. Bitte versuche es erneut.", ok: false };
  return { error: null, ok: true };
}
