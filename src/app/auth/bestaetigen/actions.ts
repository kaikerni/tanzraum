"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { internerPfad } from "@/lib/url";
import { LINK_TYPEN } from "./typen";

export type BestaetigenState = { fehler: boolean; teilweise: boolean };

// Loest den Link aus der E-Mail ein. Supabase Auth prueft Gueltigkeit, Ablauf und Einmaligkeit (token_hash).
export async function linkEinloesen(_prev: BestaetigenState, formData: FormData): Promise<BestaetigenState> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const typ = String(formData.get("type") ?? "") as EmailOtpType;
  const weiter = internerPfad(String(formData.get("weiter") ?? "/dashboard"));
  if (!tokenHash || !(LINK_TYPEN as readonly string[]).includes(typ)) return { fehler: true, teilweise: false };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typ });
  // Fehlerdetails (abgelaufen / bereits verwendet / ungueltig) bleiben bewusst neutral
  if (error) return { fehler: true, teilweise: false };

  if (typ === "recovery") redirect("/passwort-neu");
  if (typ === "email_change") {
    // Sichere E-Mail-Aenderung: der erste von zwei Links liefert noch keine neue Sitzung
    if (!data.session) return { fehler: false, teilweise: true };
    redirect("/dashboard/einstellungen?email=geaendert");
  }
  redirect(weiter);
}
