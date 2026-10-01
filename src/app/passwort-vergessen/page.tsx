import Link from "next/link";
import { EinmalFormular } from "@/components/ui/EinmalFormular";
import { authFehlerText, MAIL_FEHLER } from "@/lib/auth/fehler";
import { AuthSeite } from "@/components/auth/AuthSeite";

export const metadata = { title: "Passwort vergessen – TanzRaum" };

const FEHLER: Record<string, string> = {
  email: "Bitte gib eine gültige E-Mail-Adresse ein.",
  "zu-viele": authFehlerText({ code: "over_email_send_rate_limit" }),
  mail: MAIL_FEHLER,
  erneut: "Das hat leider nicht geklappt. Bitte versuche es erneut.",
};

// Das Formular sendet an den Route Handler ./senden (keine Server Action).
export default async function PasswortVergessenSeite({
  searchParams,
}: {
  searchParams: Promise<{ gesendet?: string; fehler?: string }>;
}) {
  const { gesendet, fehler } = await searchParams;
  return (
    <AuthSeite>
      <div className="auth-card">
        <h1 className="brand-font">Passwort vergessen?</h1>
        {gesendet ? (
          <p className="form-success">
            Wenn ein TanzRaum-Konto mit dieser E-Mail-Adresse besteht, haben wir dir soeben einen Link zum Zurücksetzen geschickt.
            Der Link ist aus Sicherheitsgründen nur begrenzte Zeit gültig und kann nur einmal verwendet werden. Keine E-Mail da?
            Schau auch im Spam-Ordner nach.
          </p>
        ) : (
          <>
            <p className="subtitle">
              Kein Problem. Gib die E-Mail-Adresse deines TanzRaum-Kontos ein – wir schicken dir einen Link, mit dem du ein neues
              Passwort festlegen kannst.
            </p>
            <EinmalFormular action="/passwort-vergessen/senden" knopf="Link zum Zurücksetzen senden" ladeText="Wird gesendet…">
              <label className="field">
                <span>E-Mail</span>
                <input type="email" name="email" autoComplete="email" required />
              </label>
              {fehler && FEHLER[fehler] && <p className="form-error">{FEHLER[fehler]}</p>}
            </EinmalFormular>
          </>
        )}
        <p className="auth-switch">
          Doch wieder eingefallen? <Link href="/login">Zur Anmeldung</Link>
        </p>
      </div>
    </AuthSeite>
  );
}
