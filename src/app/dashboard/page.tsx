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
import { getOnline } from "@/lib/online/getOnline";
import { ZEITRAEUME } from "@/lib/dashboard/zeitraeume";
import { DashboardAnsicht } from "@/components/dashboard/DashboardAnsicht";
import { KARTE } from "@/components/dashboard/Karten";
import { SpotlightLeiste } from "@/components/spotlights/SpotlightLeiste";
import { getSpotlightIch, getSpotlightLeiste, spotlightsFuerMich } from "@/lib/spotlights/getSpotlights";
import { TarifZaehler, type TarifZaehlerDaten } from "@/components/admin/TarifZaehler";
import { getAnkuendigungen, getMeineNews, getMeineUmfragen } from "@/lib/news/getNews";
import { AnkuendigungenLeiste } from "@/components/news/AnkuendigungenLeiste";
import { NewsDashboardKarte } from "@/components/news/NewsDashboardKarte";
import { getTrainingKalender, heuteBerlin } from "@/lib/training/getTraining";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wochen?: string }>;
}) {
  const supabase = await createClient();
  // Spotlights nur, wenn die TanzRaum-Administration sie fuer den eigenen Tarif eingeschaltet hat
  const spotlightsAn = await spotlightsFuerMich(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  if (daten.gesperrt) redirect("/gesperrt");

  // „Ansicht als …“ der TanzRaum-Administration: derselbe Code wie fuer echte Nutzer – die Datenbankanfragen
  // beantwortet dann der Beispielverein (vorschauFetch), Rechte und Karten ergeben sich wie in echt.

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
  // TanzRaum-Ankuendigungen (alle Nutzer) und relevante Vereins-News/offene Umfragen
  const heuteDatum = heuteBerlin();
  const [ankuendigungen, news, umfragen, online, trainingHeute] = await Promise.all([
    getAnkuendigungen(supabase),
    getMeineNews(supabase, 5),
    getMeineUmfragen(supabase, 10),
    getOnline(supabase, daten.istPlattformAdmin),
    // Nur mit Vereinslizenz liefert die Datenbank Termine (training_kalender)
    daten.istPlattformAdmin || zugriff.tarif !== "verein" ? Promise.resolve([]) : getTrainingKalender(supabase, heuteDatum, heuteDatum),
  ]);
  // Spotlights prominent oben (ansehen: alle, erstellen: ab Basic bzw. mit Vereinslizenz)
  const [spotlightIch, spotlights] = spotlightsAn
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
      {ankuendigungen.some((a) => !a.gelesenAm) && (
        <div className="mx-auto mb-4 max-w-[1560px]">
          <AnkuendigungenLeiste liste={ankuendigungen.filter((a) => !a.gelesenAm)} />
        </div>
      )}
      {(news.length > 0 || umfragen.length > 0) && (
        <div className="mx-auto mb-4 max-w-[1560px]">
          <NewsDashboardKarte news={news} umfragen={umfragen} />
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
      online={online}
      trainingHeute={trainingHeute}
      heuteDatum={heuteDatum}
    />
    </>
  );
}
