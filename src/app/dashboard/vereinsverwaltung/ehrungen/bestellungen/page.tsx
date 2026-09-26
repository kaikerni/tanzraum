import Link from "next/link";
import { PackagePlus, Package } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff, mitVerein } from "@/components/ehrungen/EhrungenKopf";
import { BestellAuswahl } from "@/components/ehrungen/EhrungenAblauf";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getBestellungen, getVorgaenge } from "@/lib/ehrungen/daten";
import { datum } from "@/lib/ehrungen/typen";

export const metadata = { title: "Bestellungen – Ehrungen – TanzRaum" };

const BESTELLSTATUS: Record<string, string> = { vorbereitet: "📦 In Vorbereitung", bestellt: "🟠 Bestellt", erhalten: "✅ Erhalten", storniert: "✖ Storniert" };

export default async function EhrungenBestellungen({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const { verein: gewaehlt } = await searchParams;
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const [vorgaenge, bestellungen] = await Promise.all([getVorgaenge(supabase, verein.vereinId), getBestellungen(supabase, verein.vereinId)]);
  const offen = vorgaenge.filter((v) => ["vorgemerkt", "geprueft"].includes(v.status) && !v.bestellungId && v.bestellungErforderlich);
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <EhrungenKopf verein={verein} vereine={vereine} aktiv="bestellungen" />
      <section className={KARTE}>
        <KarteKopf icon={PackagePlus} titel="Für Bestellung vorbereiten" untertitel="Vorgemerkte bzw. geprüfte Ehrungen, für die eine Bestellung erforderlich ist" />
        <BestellAuswahl vereinId={verein.vereinId} vorgaenge={offen} />
      </section>
      <section className={KARTE}>
        <KarteKopf icon={Package} titel="Bestellungen" />
        {bestellungen.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Bestellungen.</p>
        ) : (
          <ul className="divide-y divide-brand-line overflow-hidden rounded-xl border border-brand-line">
            {bestellungen.map((b) => {
              const anzahl = vorgaenge.filter((v) => v.bestellungId === b.id).length;
              return (
                <li key={b.id}>
                  <Link href={mitVerein(`${EHRUNGEN_PFAD}/bestellung/${b.id}`, verein.vereinId)} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 hover:bg-brand-bg">
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-brand-ink">{b.bezeichnung}</span>
                      <span className="text-[12.5px] text-brand-ink-soft">
                        {anzahl} Ehrung{anzahl === 1 ? "" : "en"} · angelegt {datum(b.createdAt)}
                        {b.bestelltAm ? ` · bestellt ${datum(b.bestelltAm)}` : ""}
                        {b.bestellnummer ? ` · Nr. ${b.bestellnummer}` : ""}
                      </span>
                    </span>
                    <span className="text-[12.5px] font-semibold text-brand-ink">{BESTELLSTATUS[b.status]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
