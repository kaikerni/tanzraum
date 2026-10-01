import Link from "next/link";
import { RechtsLinks } from "@/components/recht/RechtsLinks";
import { SignupForm } from "./SignupForm";
import { internerPfad } from "@/lib/url";
import { AuthSeite } from "@/components/auth/AuthSeite";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const { weiter } = await searchParams;
  const ziel = internerPfad(weiter);

  return (
    <AuthSeite>
      <div className="auth-card">
        <h1 className="brand-font">Konto erstellen</h1>
        <p className="subtitle">Starte kostenlos mit dem Free-Tarif.</p>
        <SignupForm weiter={ziel} />
        <p className="auth-switch">
          Schon ein Konto?{" "}
          <Link href={ziel === "/dashboard" ? "/login" : `/login?weiter=${encodeURIComponent(ziel)}`}>Jetzt anmelden</Link>
        </p>
        <RechtsLinks className="mt-4 justify-center" />
      </div>
    </AuthSeite>
  );
}
