import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getZugriff } from "@/lib/dashboard/getBereiche";
import {
  getKennzahlen,
  getNaechsteTermine,
  getNaechsteTurniere,
  getAltersklassen,
  getHeute,
  getBeteiligungVerlauf,
  getRadar,
  getMeineKinder,
} from "@/lib/dashboard/getDashboardUebersicht";
import { getAktuelleNachrichten } from "@/lib/dashboard/getNachrichten";
import { ZEITRAEUME } from "@/components/dashboard/ZeitraumAuswahl";
import { DashboardAnsicht } from "@/components/dashboard/DashboardAnsicht";
import { KARTE } from "@/components/dashboard/Karten";
import { SpotlightLeiste } from "@/components/spotlights/SpotlightLeiste";
import { getSpotlightIch, getSpotlightLeiste } from "@/lib/spotlights/getSpotlights";
import { SPOTLIGHTS_AKTIV } from "@/lib/spotlights/typen";
import { TarifZaehler, type TarifZaehlerDaten } from "@/components/admin/TarifZaehler";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wochen?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  if (daten.gesperrt) redirect("/gesperrt");

  const { wochen: wochenParam } = await searchParams;
  const wochen = ZEITRAEUME.find((w) => String(w) === wochenParam) ?? 8;

  const [zugriff, kennzahlen, termine, turniere, altersklassen, heute, verlauf, radar, nachrichten, kinder] =
    await Promise.all([
      getZugriff(supabase, daten.istPlattformAdmin),
      getKennzahlen(supabase),
      getNaechsteTermine(supabase, 6),
      getNaechsteTurniere(supabase, 4),
      getAltersklassen(supabase),
      getHeute(supabase),
      getBeteiligungVerlauf(supabase, wochen),
      getRadar(supabase),
      getAktuelleNachrichten(supabase, user.id, 4),
      getMeineKinder(supabase),
    ]);
  // Spotlights prominent oben (ansehen: alle, erstellen: ab Basic bzw. mit Vereinslizenz)
  const [spotlightIch, spotlights] = SPOTLIGHTS_AKTIV
    ? await Promise.all([getSpotlightIch(supabase, user), getSpotlightLeiste(supabase)])
    : [null, []];

  // TanzRaum-Administration: Zaehler Free/Basic/Verein (Klick -> Listen)
  let tarifZaehler: TarifZaehlerDaten | null = null;
  if (daten.istPlattformAdmin) {
    const { data } = await supabase.rpc("admin_tarif_zaehler");
    const z = ((data ?? []) as TarifZaehlerDaten[])[0];
    if (z) {
      tarifZaehler = {
        free: Number(z.free),
        basic: Number(z.basic),
        verein: Number(z.verein),
        vereine_mit_lizenz: Number(z.vereine_mit_lizenz),
        basic_pausiert: Number(z.basic_pausiert),
      };
    }
  }

  return (
    <>
      {tarifZaehler && (
        <div className="mx-auto mb-4 max-w-[1560px]">
          <TarifZaehler z={tarifZaehler} />
        </div>
      )}
      {spotlightIch && (spotlightIch.darfErstellen || spotlights.length > 0) && (
        <section className={`${KARTE} mx-auto mb-4 max-w-[1560px] py-3`} aria-label="Spotlights">
          <SpotlightLeiste personen={spotlights} ich={spotlightIch} />
        </section>
      )}
    <DashboardAnsicht
      daten={daten}
      zugriff={zugriff}
      kennzahlen={kennzahlen}
      termine={termine}
      turniere={turniere}
      altersklassen={altersklassen}
      heute={heute}
      verlauf={verlauf}
      radar={radar}
      nachrichten={nachrichten}
      kinder={kinder}
      wochen={wochen}
    />
    </>
  );
}
