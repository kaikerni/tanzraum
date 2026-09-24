import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Willkommen zurück</h1>
        <p className="subtitle">Melde dich bei TanzRaum an.</p>
        <LoginForm weiter={weiter ?? "/dashboard"} />
        <p className="auth-switch">
          Noch kein Konto? <Link href="/signup">Jetzt registrieren</Link>
        </p>
      </div>
    </div>
  );
}
