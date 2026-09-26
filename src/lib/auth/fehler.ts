// Uebersetzt Fehler von Supabase Auth in verstaendliche, neutrale Meldungen.
// Rohtexte (z. B. von Brevo oder dem E-Mail-Hook) gelangen nie in die Oberflaeche.

type AuthFehler = { code?: string; message?: string; status?: number } | null | undefined;

export const MAIL_FEHLER = "Die E-Mail konnte momentan nicht versendet werden. Bitte versuche es später erneut.";

export function authFehlerText(fehler: AuthFehler, standard = "Das hat leider nicht geklappt. Bitte versuche es später erneut."): string {
  if (!fehler) return standard;
  const code = fehler.code ?? "";
  const text = (fehler.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || text.includes("invalid login credentials")) return "E-Mail oder Passwort ist falsch.";
  if (code === "email_not_confirmed" || text.includes("email not confirmed"))
    return "Bitte bestätige zuerst deine E-Mail-Adresse. Den Link dazu findest du in unserer Willkommens-E-Mail.";
  if (code === "weak_password" || text.includes("password should"))
    return "Das Passwort ist zu unsicher. Bitte nutze mindestens 8 Zeichen, am besten mit Zahlen und Sonderzeichen.";
  if (code === "same_password") return "Das neue Passwort muss sich von deinem bisherigen Passwort unterscheiden.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || fehler.status === 429)
    return "Zu viele Versuche in kurzer Zeit. Bitte warte einen Moment und versuche es dann erneut.";
  if (code === "email_address_invalid" || (text.includes("email address") && text.includes("invalid")))
    return "Bitte gib eine gültige E-Mail-Adresse ein.";
  if (code === "email_exists" || code === "user_already_exists") return "Diese E-Mail-Adresse wird bereits verwendet.";
  if (code === "signup_disabled") return "Registrierungen sind im Moment nicht möglich.";
  if (code.startsWith("hook_") || text.includes("sending") || text.includes("hook")) return MAIL_FEHLER;
  return standard;
}
