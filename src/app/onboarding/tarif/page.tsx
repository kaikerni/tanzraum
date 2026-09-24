import { TarifForm } from "./TarifForm";

export default function OnboardingTarifPage() {
  return (
    <div className="card">
      <div className="mb-1 text-[12px] font-semibold text-brand-ink-soft">Schritt 1 von 3</div>
      <h1 className="mb-1 font-display text-2xl font-bold text-brand-ink">Wähle deinen Tarif</h1>
      <p className="mb-5 text-[13.5px] text-brand-ink-soft">
        Du kannst das jederzeit später ändern.
      </p>
      <TarifForm />
    </div>
  );
}
