import { TarifForm } from "./TarifForm";
import { createClient } from "@/lib/supabase/server";
import { getPreise } from "@/lib/tarife";

export default async function OnboardingTarifPage() {
  const supabase = await createClient();
  const preise = await getPreise(supabase);
  return (
    <div className="card">
      <div className="mb-1 text-[12px] font-semibold text-brand-ink-soft">Schritt 1 von 3</div>
      <h1 className="mb-1 font-display text-2xl font-bold text-brand-ink">Wähle deinen Tarif</h1>
      <p className="mb-5 text-[13.5px] text-brand-ink-soft">
        Du kannst das jederzeit später ändern.
      </p>
      <TarifForm preise={preise} />
    </div>
  );
}
