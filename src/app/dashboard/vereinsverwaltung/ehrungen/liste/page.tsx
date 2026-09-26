import { KARTE } from "@/components/dashboard/Karten";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff } from "@/components/ehrungen/EhrungenKopf";
import { VorgaengeListe } from "@/components/ehrungen/VorgaengeListe";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getVorgaenge } from "@/lib/ehrungen/daten";
import { STATUS } from "@/lib/ehrungen/typen";

export const metadata = { title: "Alle Ehrungen – TanzRaum" };

export default async function EhrungenListe({ searchParams }: { searchParams: Promise<{ verein?: string; status?: string }> }) {
  const { verein: gewaehlt, status } = await searchParams;
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const vorgaenge = await getVorgaenge(supabase, verein.vereinId);
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <EhrungenKopf verein={verein} vereine={vereine} aktiv="liste" />
      <section className={KARTE}>
        <VorgaengeListe vorgaenge={vorgaenge} basis={EHRUNGEN_PFAD} startStatus={status && status in STATUS ? status : ""} />
      </section>
    </div>
  );
}
