import type { NextRequest } from "next/server";
import { feld, gleicherUrsprung, routeClient, weiterleiten } from "@/lib/auth/formularRoute";
import { basisUrl } from "@/lib/url";

// Supabase Auth erzeugt den einmaligen, zeitlich begrenzten Link; der Versand laeuft ueber den Send Email Hook
// (Edge Function auth-email -> Brevo). Die Antwort ist immer gleich, egal ob die Adresse registriert ist – so laesst
// sich nicht herausfinden, wer ein Konto hat. Die E-Mail-Adresse erscheint nie in einer Adresse (URL).
export async function POST(request: NextRequest) {
  if (!gleicherUrsprung(request)) return weiterleiten("/passwort-vergessen?fehler=erneut");
  const email = feld(await request.formData(), "email").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return weiterleiten("/passwort-vergessen?fehler=email");

  const { supabase } = routeClient(request);
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await basisUrl()}/passwort-neu` });
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return weiterleiten("/passwort-vergessen?fehler=zu-viele");
  }
  // Versand fehlgeschlagen (z. B. Brevo nicht erreichbar): keine falsche Erfolgsmeldung
  if (error && (error.status ?? 0) >= 500) return weiterleiten("/passwort-vergessen?fehler=mail");
  return weiterleiten("/passwort-vergessen?gesendet=1");
}
