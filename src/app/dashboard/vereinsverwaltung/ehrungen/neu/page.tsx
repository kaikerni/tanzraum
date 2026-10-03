import { KARTE } from "@/components/dashboard/Karten";
import { EhrungenKopf, KeinZugriff } from "@/components/ehrungen/EhrungenKopf";
import { ManuelleEhrung } from "@/components/ehrungen/EhrungenFormulare";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getAuszeichnungen } from "@/lib/ehrungen/daten";
import { getMitgliederListe } from "@/lib/mitglieder/getMitglieder";

export const metadata = { title: "Ehrung hinzufügen – TanzRaum" };

export default async function EhrungNeu({ searchParams }: { searchParams: Promise<{ verein?: string; mitglied?: string }> }) {
  const { verein: gewaehlt, mitglied } = await searchParams;
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const [arten, mitglieder] = await Promise.all([getAuszeichnungen(supabase, verein.vereinId), getMitgliederListe(supabase, verein.vereinId)]);
  const alle = [...arten.verband, ...arten.verein];
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <EhrungenKopf verein={verein} vereine={vereine} titel="Ehrung manuell hinzufügen" />
      <section className={KARTE}>
        {alle.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">
            Es sind noch keine Auszeichnungen verfügbar. Legen Sie unter „Auszeichnungen“ eigene Vereinsauszeichnungen an oder wählen Sie die Verbände Ihres
            Vereins aus.
          </p>
        ) : (
          <ManuelleEhrung
            vereinId={verein.vereinId}
            mitglieder={(mitglieder ?? []).map((m) => ({ vmId: m.vmId, name: m.name }))}
            arten={alle}
            vorbelegt={mitglied}
          />
        )}
      </section>
    </div>
  );
}
