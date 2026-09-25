"use server";

import { createClient } from "@/lib/supabase/server";
import { authFehlerText, MAIL_FEHLER } from "@/lib/auth/fehler";
import { basisUrl } from "@/lib/url";

export type VergessenState = { error: string | null; gesendet: boolean };

// Supabase Auth erzeugt den einmaligen, zeitlich begrenzten Link; der Versand laeuft ueber den
// Send Email Hook (Edge Function auth-email -> Brevo). Die Antwort ist immer gleich, egal ob die
// Adresse registriert ist – so laesst sich nicht herausfinden, wer ein Konto hat.
export async function passwortLinkAnfordern(_prev: VergessenState, formData: FormData): Promise<VergessenState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Bitte gib eine gültige E-Mail-Adresse ein.", gesendet: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await basisUrl()}/passwort-neu` });
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { error: authFehlerText(error), gesendet: false };
  }
  // Versand fehlgeschlagen (z. B. Brevo nicht erreichbar): keine falsche Erfolgsmeldung
  if (error && (error.status ?? 0) >= 500) return { error: MAIL_FEHLER, gesendet: false };
  return { error: null, gesendet: true };
}
