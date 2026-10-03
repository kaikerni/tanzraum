import Link from "next/link";
import { Home, Landmark, Plus, Building } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff, mitVerein } from "@/components/ehrungen/EhrungenKopf";
import { PruefBadge } from "@/components/ehrungen/Badges";
import { OrganisationenFormular } from "@/components/ehrungen/EhrungenFormulare";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getAnpassungen, getAuszeichnungen, getOrganisationen } from "@/lib/ehrungen/daten";
import { regelKurz, wirksameRegel, type Anpassung, type Auszeichnung } from "@/lib/ehrungen/typen";

export const metadata = { title: "Auszeichnungen – TanzRaum" };

function Zeile({ a, href, anpassungen }: { a: Auszeichnung; href: string; anpassungen?: Map<string, Anpassung> }) {
  const regeln = a.regeln.flatMap((r) => {
    const ap = anpassungen?.get(r.id);
    if (ap && !ap.aktiv) return [];
    return [regelKurz(wirksameRegel(r, ap)) + (ap ? " (angepasst)" : "")];
  });
  return (
    <li>
      <Link href={href} className="grid grid-cols-1 gap-1 px-3.5 py-3 hover:bg-brand-bg md:grid-cols-[1.4fr_1.6fr_auto] md:items-center md:gap-3">
        <span className="min-w-0">
          <span className={`block truncate text-[14px] font-semibold ${a.aktiv ? "text-brand-ink" : "text-brand-ink-faint line-through"}`}>
            {a.symbol ? `${a.symbol} ` : ""}
            {a.name}
          </span>
          <span className="text-[12px] text-brand-ink-soft">
            {[a.serie && a.stufe ? `${a.serie} · Stufe ${a.stufe}` : a.serie, a.kategorie, a.bestellungErforderlich ? "Bestellung erforderlich" : "keine Bestellung"]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="text-[12.5px] text-brand-ink-soft">{regeln.length ? regeln.join(" / ") : (a.voraussetzungen ?? "Kriterien nicht hinterlegt")}</span>
        <span>
          <PruefBadge status={a.pruefstatus} />
        </span>
      </Link>
    </li>
  );
}

export default async function EhrungenAuszeichnungen({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const { verein: gewaehlt } = await searchParams;
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const [arten, organisationen] = await Promise.all([getAuszeichnungen(supabase, verein.vereinId), getOrganisationen(supabase, verein.vereinId)]);
  const anpassungen = await getAnpassungen(
    supabase,
    verein.vereinId,
    arten.verband.flatMap((a) => a.regeln.map((r) => r.id)),
  );
  const detail = (a: Auszeichnung) => mitVerein(`${EHRUNGEN_PFAD}/auszeichnung/${a.id}`, verein.vereinId);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <EhrungenKopf verein={verein} vereine={vereine} aktiv="auszeichnungen" />

      <section className={KARTE}>
        <KarteKopf
          icon={Home}
          titel="🏠 Vereinseigene Auszeichnungen"
          untertitel="Nadeln, Orden, Jubiläums- und Dankesauszeichnungen Ihres Vereins – mit eigenen Stufen und Regeln"
          rechts={
            <Link
              href={mitVerein(`${EHRUNGEN_PFAD}/auszeichnung/neu`, verein.vereinId)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand-red px-3 text-[13px] font-semibold text-white hover:bg-brand-red-deep"
            >
              <Plus size={15} /> Eigene Auszeichnung erstellen
            </Link>
          }
        />
        {arten.verein.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine eigenen Auszeichnungen angelegt.</p>
        ) : (
          <ul className="divide-y divide-brand-line overflow-hidden rounded-xl border border-brand-line">
            {arten.verein.map((a) => (
              <Zeile key={a.id} a={a} href={detail(a)} />
            ))}
          </ul>
        )}
      </section>

      <section className={KARTE}>
        <KarteKopf icon={Building} titel="Verbände und Organisationen Ihres Vereins" untertitel="Bestimmt, welche Verbandsauszeichnungen vorgeschlagen werden" />
        <OrganisationenFormular vereinId={verein.vereinId} organisationen={organisationen} />
      </section>

      <section className={KARTE}>
        <KarteKopf
          icon={Landmark}
          titel="🏛️ Verbandsauszeichnungen"
          untertitel="Zentraler Katalog, gepflegt von TanzRaum. Teilweise aus einer ungeprüften Arbeitsgrundlage übernommen – bitte vor einer Bestellung prüfen."
        />
        {arten.verband.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Für die ausgewählten Verbände sind noch keine Auszeichnungen hinterlegt.</p>
        ) : (
          <ul className="divide-y divide-brand-line overflow-hidden rounded-xl border border-brand-line">
            {arten.verband.map((a) => (
              <Zeile key={a.id} a={{ ...a, name: `${a.name}${a.organisation ? ` · ${a.organisation}` : ""}` }} href={detail(a)} anpassungen={anpassungen} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
