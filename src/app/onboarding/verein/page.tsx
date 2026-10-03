import { VereinForm } from "./VereinForm";

export default function OnboardingVereinPage() {
  return (
    <div className="card">
      <div className="mb-1 text-[12px] font-semibold text-brand-ink-soft">Schritt 2 von 3</div>
      <h1 className="mb-1 font-display text-2xl font-bold text-brand-ink">
        Möchtest du einen Verein gründen?
      </h1>
      <p className="mb-5 text-[13.5px] text-brand-ink-soft">
        Vereinsverwaltung gibt es mit der Vereinslizenz: Lizenz kaufen – nach bestätigter Zahlung wird dein Verein angelegt und du wirst Vereinsadmin.
        Tanzt du einfach in einem Verein? Dann geh einfach weiter – dein Verein lädt dich ein.
      </p>
      <VereinForm />
    </div>
  );
}
