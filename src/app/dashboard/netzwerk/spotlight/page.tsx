import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { netzwerkZugang } from "@/lib/netzwerk/netzwerkZugang";
import { getSpotlightIch, getSpotlightLeiste } from "@/lib/spotlights/getSpotlights";
import { SpotlightLeiste } from "@/components/spotlights/SpotlightLeiste";
import { KARTE } from "@/components/dashboard/Karten";

export const metadata = { title: "Spotlight – TanzRaum-Netzwerk" };

// Spotlight (nur im Netzwerk): ansehen mit jedem Tarif, erstellen/verwalten/loeschen ab BASIC (Datenbank prueft)
export default async function SpotlightSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { darf } = await netzwerkZugang(supabase);
  if (!darf("spotlight")) redirect("/dashboard/netzwerk");
  const [personen, ich] = await Promise.all([getSpotlightLeiste(supabase), getSpotlightIch(supabase, user)]);
  return (
    <>
      <section className={`${KARTE} py-4`} aria-label="Spotlights">
        <SpotlightLeiste personen={personen} ich={ich} gross />
        {personen.length === 0 && <p className="mt-2 text-[13.5px] text-brand-ink-soft">Gerade teilt niemand ein Spotlight.</p>}
      </section>
      <p className="text-[13px] text-brand-ink-soft">
        Spotlights sind persönliche Fotos, die 24 Stunden sichtbar sind.
        {ich.darfErstellen ? " Tippe auf „+ Spotlight“, um eins zu teilen – deine eigenen kannst du jederzeit löschen." : " Eigene Spotlights erstellen kannst du ab BASIC."}
      </p>
    </>
  );
}
