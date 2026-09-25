"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authFehlerText } from "@/lib/auth/fehler";
import { basisUrl, internerPfad } from "@/lib/url";

export type LoginState = { error: string | null; unbestaetigt?: string | null; ok?: string | null };

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const weiter = String(formData.get("weiter") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") return { error: authFehlerText(error), unbestaetigt: email };
    // Der custom_access_token_hook meldet gesperrte Konten ueber eine eigene, deutsche Meldung.
    if (error.message.toLowerCase().includes("gesperrt")) return { error: error.message };
    return { error: authFehlerText(error, "Die Anmeldung hat nicht geklappt. Bitte versuche es erneut.") };
  }

  redirect(internerPfad(weiter));
}

// Bestaetigungs-E-Mail erneut senden. Antwortet immer gleich, damit sich nicht herausfinden laesst,
// ob eine Adresse registriert ist.
export async function bestaetigungErneutSenden(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const weiter = internerPfad(String(formData.get("weiter") ?? "/dashboard"));
  if (!email) return { error: "Bitte gib deine E-Mail-Adresse ein." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await basisUrl()}${weiter}` },
  });
  if (error?.status === 429 || error?.code === "over_email_send_rate_limit") {
    return { error: authFehlerText(error), unbestaetigt: email };
  }
  return { error: null, ok: "Falls für diese Adresse ein unbestätigtes Konto besteht, haben wir dir eine neue Bestätigungs-E-Mail geschickt." };
}
