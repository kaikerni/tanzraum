import { signOut } from "@/app/actions";

export default function GesperrtPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Konto gesperrt</h1>
        <p className="subtitle">
          Dein Konto oder dein Verein wurde gesperrt. Bitte wende dich an den
          TanzRaum-Support (info@tanzraum.app), um das klären zu lassen.
        </p>
        <form action={signOut}>
          <button type="submit" className="btn-primary">
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}
