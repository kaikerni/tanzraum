import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSpotlightIch, getSpotlightLeiste, spotlightsFuerMich } from "@/lib/spotlights/getSpotlights";
import { SpotlightLeiste } from "@/components/spotlights/SpotlightLeiste";
import { KARTE } from "@/components/dashboard/Karten";

export const metadata = { title: "Spotlight – TanzRaum" };

// ✨ Spotlight: eigener Bereich fuer Stories. Ansehen mit jedem Tarif (Schalter der Administration),
// erstellen, verwalten und loeschen ab BASIC bzw. ueber die Vereinslizenz (Datenbank prueft).
export default async function SpotlightSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/spotlight");
  if (!(await spotlightsFuerMich(supabase))) redirect("/dashboard");
  const [personen, ich] = await Promise.all([getSpotlightLeiste(supabase), getSpotlightIch(supabase, user)]);
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Sparkles size={24} className="text-brand-gold" /> Spotlight
        </h1>
        <p className="text-[14px] text-brand-ink-soft">
          Stories aus dem TanzRaum – 24 Stunden sichtbar.
          {ich.darfErstellen ? " Tippe auf „Neue Story“, um deine eigene zu erstellen." : " Eigene Stories erstellen kannst du ab BASIC."}
        </p>
      </div>
      <section className={`${KARTE} py-4`} aria-label="Stories">
        <SpotlightLeiste personen={personen} ich={ich} raster />
      </section>
    </div>
  );
}
