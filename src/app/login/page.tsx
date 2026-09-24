import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { internerPfad } from "@/lib/url";

const HINWEISE: Record<string, string> = {
  bestaetigt: "Deine E-Mail-Adresse ist bestätigt. Du kannst dich jetzt anmelden.",
  "passwort-geaendert": "Dein Passwort wurde geändert. Bitte melde dich mit dem neuen Passwort an.",
  abgemeldet: "Du wurdest abgemeldet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; hinweis?: string }>;
}) {
  const { weiter, hinweis } = await searchParams;
  const ziel = internerPfad(weiter);
  const text = hinweis ? HINWEISE[hinweis] : undefined;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Willkommen zurück</h1>
        <p className="subtitle">Melde dich bei TanzRaum an.</p>
        {text && <p className="form-success auth-hinweis">{text}</p>}
        <LoginForm weiter={ziel} />
        <p className="auth-switch">
          Noch kein Konto?{" "}
          <Link href={ziel === "/dashboard" ? "/signup" : `/signup?weiter=${encodeURIComponent(ziel)}`}>Jetzt registrieren</Link>
        </p>
      </div>
    </div>
  );
}
