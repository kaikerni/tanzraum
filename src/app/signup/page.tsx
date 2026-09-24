import Link from "next/link";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Konto erstellen</h1>
        <p className="subtitle">Starte kostenlos mit dem Free-Tarif.</p>
        <SignupForm />
        <p className="auth-switch">
          Schon ein Konto? <Link href="/login">Jetzt anmelden</Link>
        </p>
      </div>
    </div>
  );
}
