import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EinmalFormular } from "@/components/ui/EinmalFormular";
import { authFehlerText } from "@/lib/auth/fehler";

export const metadata = { title: "Neues Passwort – TanzRaum" };

const FEHLER: Record<string, string> = {
  kurz: "Das Passwort muss mindestens 8 Zeichen lang sein.",
  ungleich: "Die beiden Passwörter stimmen nicht überein.",
  weak_password: authFehlerText({ code: "weak_password" }),
  same_password: authFehlerText({ code: "same_password" }),
  speichern: "Das Passwort konnte nicht gespeichert werden. Bitte versuche es erneut.",
};

// Das Formular sendet an den Route Handler ./speichern (keine Server Action).
export default async function PasswortNeuSeite({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: recovery } = user ? await supabase.rpc("ist_recovery_sitzung") : { data: false };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {recovery === true && fehler !== "abgelaufen" ? (
          <>
            <h1 className="brand-font">Neues Passwort festlegen</h1>
            <p className="subtitle">Wähle ein neues Passwort für dein TanzRaum-Konto ({user?.email}).</p>
            <EinmalFormular action="/passwort-neu/speichern" knopf="Passwort speichern" ladeText="Wird gespeichert…">
              <label className="field">
                <span>Neues Passwort</span>
                <input type="password" name="passwort" autoComplete="new-password" minLength={8} required />
              </label>
              <label className="field">
                <span>Neues Passwort wiederholen</span>
                <input type="password" name="wiederholung" autoComplete="new-password" minLength={8} required />
              </label>
              <p className="text-[12.5px] text-brand-ink-soft">Mindestens 8 Zeichen, am besten mit Zahlen und Sonderzeichen.</p>
              {fehler && FEHLER[fehler] && <p className="form-error">{FEHLER[fehler]}</p>}
            </EinmalFormular>
          </>
        ) : (
          <>
            <h1 className="brand-font">Link abgelaufen</h1>
            <p className="subtitle">
              Der Link zum Zurücksetzen ist abgelaufen, wurde bereits verwendet oder ist ungültig. Aus Sicherheitsgründen ist er nur
              kurze Zeit gültig.
            </p>
            <Link href="/passwort-vergessen" className="btn-primary block text-center">
              Neuen Link anfordern
            </Link>
            {user && (
              <p className="auth-switch">
                Du bist angemeldet und möchtest dein Passwort ändern? <Link href="/dashboard/einstellungen">Zu den Einstellungen</Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
