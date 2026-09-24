import { VereinForm } from "./VereinForm";

export default function OnboardingVereinPage() {
  return (
    <div className="card">
      <div className="mb-1 text-[12px] font-semibold text-brand-ink-soft">Schritt 2 von 3</div>
      <h1 className="mb-1 font-display text-2xl font-bold text-brand-ink">
        Leitest du einen Verein?
      </h1>
      <p className="mb-5 text-[13.5px] text-brand-ink-soft">
        Lege deinen Verein an, oder überspringe diesen Schritt.
      </p>
      <VereinForm />
    </div>
  );
}
