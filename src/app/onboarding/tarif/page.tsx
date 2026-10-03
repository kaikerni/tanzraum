import { TarifForm } from "./TarifForm";
import { createClient } from "@/lib/supabase/server";
import { getPreise } from "@/lib/tarife";
import { TanzRaumAssistant } from "@/components/kai/TanzRaumAssistant";

export default async function OnboardingTarifPage() {
  const supabase = await createClient();
  const preise = await getPreise(supabase);
  return (
    <div className="card">
      <div className="mb-1 text-[12px] font-semibold text-brand-ink-soft">Schritt 1 von 3</div>
      <h1 className="mb-1 font-display text-2xl font-bold text-brand-ink">Wähle deinen Tarif</h1>
      <p className="mb-4 text-[13.5px] text-brand-ink-soft">
        Du kannst das jederzeit später ändern.
      </p>
      <TanzRaumAssistant
        variant="welcome"
        className="mb-5"
        title="👋 Hallo, ich bin Kai!"
        message="Ich helfe dir dabei, TanzRaum einzurichten. Zuerst wählst du deinen Tarif – danach gehen wir im Dashboard gemeinsam die wichtigsten Einstellungen durch."
      >
        Du entscheidest bei jedem Schritt selbst.
      </TanzRaumAssistant>
      <TarifForm preise={preise} />
    </div>
  );
}
