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
  const neu = personen.filter((p) => !p.ich && p.ungesehen > 0).length;
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1200px] flex-col gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Sparkles size={24} className="text-brand-gold" /> Spotlight
        </h1>
        <p className="text-[14px] text-brand-ink-soft">
          Stories aus dem TanzRaum – 24 Stunden sichtbar.
          {ich.darfErstellen ? " Tippe auf „Mein Spotlight“, um deine eigene zu erstellen." : " Eigene Stories erstellen kannst du ab BASIC."}
        </p>
      </div>
      <section className={`${KARTE} min-w-0 py-4`} aria-label="Stories">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-brand-ink">Stories</h2>
          {neu > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-0.5 text-[11.5px] font-bold text-white">
              <Sparkles size={11} className="text-[#f2d58c]" /> {neu} neu
            </span>
          )}
        </div>
        <SpotlightLeiste personen={personen} ich={ich} />
      </section>
    </div>
  );
}
