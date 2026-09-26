import Link from "next/link";
import { notFound } from "next/navigation";
import { ListOrdered, Boxes, Settings2, FileDown, Printer } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff } from "@/components/ehrungen/EhrungenKopf";
import { StatusBadge, TypBadge } from "@/components/ehrungen/Badges";
import { AusBestellungEntfernen, BestellungAktionen } from "@/components/ehrungen/EhrungenAblauf";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getBestellung, getVorgaenge, mengen } from "@/lib/ehrungen/daten";
import { datum, grundlageZeilen } from "@/lib/ehrungen/typen";

export const metadata = { title: "Bestellung – Ehrungen – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOPF = "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg";

export default async function BestellungSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, vereine, ohneLizenz } = await ehrungsKontext();
  const bestellung = await getBestellung(supabase, id);
  const verein = bestellung ? vereine.find((v) => v.vereinId === bestellung.vereinId) : null;
  if (!bestellung || !verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const vorgaenge = (await getVorgaenge(supabase, verein.vereinId)).filter((v) => v.bestellungId === id);
  const menge = mengen(vorgaenge);

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <EhrungenKopf
        verein={verein}
        vereine={[]}
        titel={bestellung.bezeichnung}
        rechts={
          <>
            <Link href={`/druck/ehrungen/bestellung/${id}`} target="_blank" className={KNOPF}>
              <Printer size={15} /> PDF-Ansicht
            </Link>
            <a href={`${EHRUNGEN_PFAD}/export?art=bestellung&id=${id}`} className={KNOPF}>
              <FileDown size={15} /> CSV
            </a>
          </>
        }
      />
      <p className="text-[13.5px] text-brand-ink-soft">
        Status: <strong className="text-brand-ink">{bestellung.status}</strong>
        {bestellung.bestelltAm ? ` · bestellt am ${datum(bestellung.bestelltAm)}` : ""}
        {bestellung.geliefertAm ? ` · erhalten am ${datum(bestellung.geliefertAm)}` : ""}
        {bestellung.bestellnummer ? ` · Bestellnummer ${bestellung.bestellnummer}` : ""}
        {bestellung.anbieter ? ` · ${bestellung.anbieter}` : ""}
      </p>

      <section className={KARTE}>
        <KarteKopf icon={Boxes} titel="Mengenübersicht" />
        <ul className="divide-y divide-brand-line rounded-xl border border-brand-line">
          {menge.map((m) => (
            <li key={m.auszeichnung + m.organisation} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[13.5px]">
              <span className="flex flex-wrap items-center gap-2">
                <TypBadge typ={m.typ} />
                <span className="font-semibold text-brand-ink">{m.auszeichnung}</span>
                {m.organisation && <span className="text-brand-ink-soft">{m.organisation}</span>}
              </span>
              <span className="text-[15px] font-extrabold text-brand-ink">{m.anzahl} Stück</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={KARTE}>
        <KarteKopf icon={ListOrdered} titel="Detailliste – wer bekommt was und warum" />
        <ul className="divide-y divide-brand-line rounded-xl border border-brand-line">
          {vorgaenge.map((v) => (
            <li key={v.id} className="flex items-start justify-between gap-2 px-3.5 py-2.5">
              <Link href={`${EHRUNGEN_PFAD}/${v.id}`} className="min-w-0 text-[13.5px] hover:text-brand-red">
                <span className="font-semibold text-brand-ink">{v.personName}</span> – {v.auszeichnung}
                <span className="block text-[12px] text-brand-ink-soft">
                  {v.organisation ?? "vereinsintern"} · Grund: {v.grundlageText ?? grundlageZeilen(v.grundlage)[0]} · gewünscht {datum(v.wunschDatum ?? v.faelligAm)}
                </span>
              </Link>
              <span className="flex shrink-0 items-center gap-1">
                <StatusBadge status={v.status} />
                {bestellung.status === "vorbereitet" && <AusBestellungEntfernen vorgangId={v.id} />}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {(bestellung.status === "vorbereitet" || bestellung.status === "bestellt") && (
        <section className={KARTE}>
          <KarteKopf icon={Settings2} titel={bestellung.status === "vorbereitet" ? "Bestellen" : "Lieferung"} />
          <BestellungAktionen bestellungId={id} status={bestellung.status} />
        </section>
      )}
    </div>
  );
}
