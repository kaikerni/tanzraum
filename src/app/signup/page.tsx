import Link from "next/link";
import { SignupForm } from "./SignupForm";
import { internerPfad } from "@/lib/url";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const { weiter } = await searchParams;
  const ziel = internerPfad(weiter);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Konto erstellen</h1>
        <p className="subtitle">Starte kostenlos mit dem Free-Tarif.</p>
        <SignupForm weiter={ziel} />
        <p className="auth-switch">
          Schon ein Konto?{" "}
          <Link href={ziel === "/dashboard" ? "/login" : `/login?weiter=${encodeURIComponent(ziel)}`}>Jetzt anmelden</Link>
        </p>
      </div>
    </div>
  );
}
