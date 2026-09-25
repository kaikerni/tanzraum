import Link from "next/link";
import { RechtsLinks } from "@/components/recht/RechtsLinks";
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
        <p className="mt-3 text-center text-[12px] text-brand-ink-soft">
          Mit der Registrierung akzeptierst du die <Link href="/nutzungsbedingungen" className="underline">Nutzungsbedingungen</Link>.
          Wie wir mit deinen Daten umgehen, steht in der <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link>.
        </p>
        <RechtsLinks className="mt-4 justify-center" />
      </div>
    </div>
  );
}
