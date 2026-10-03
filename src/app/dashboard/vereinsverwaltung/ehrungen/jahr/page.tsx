import Link from "next/link";
import { CalendarRange, FileDown, Printer } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff, mitVerein } from "@/components/ehrungen/EhrungenKopf";
import { StatusBadge, TypBadge } from "@/components/ehrungen/Badges";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getVorgaenge } from "@/lib/ehrungen/daten";
import { MONATE, datum, jahresEintraege, stichtagVon } from "@/lib/ehrungen/typen";

export const metadata = { title: "Jahresübersicht – Ehrungen – TanzRaum" };
const KNOPF = "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg";

export default async function EhrungenJahr({ searchParams }: { searchParams: Promise<{ verein?: string; jahr?: string }> }) {
  const sp = await searchParams;
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(sp.verein);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const aktuell = new Date().getFullYear();
  const jahr = /^\d{4}$/.test(sp.jahr ?? "") ? Number(sp.jahr) : aktuell;
  const eintraege = jahresEintraege(await getVorgaenge(supabase, verein.vereinId), jahr);
  const jahrLink = (j: number) => mitVerein(`${EHRUNGEN_PFAD}/jahr?jahr=${j}`, verein.vereinId);

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <EhrungenKopf
        verein={verein}
        vereine={vereine}
        aktiv="jahr"
        rechts={
          <>
            <Link href={`/druck/ehrungen/uebersicht?verein=${verein.vereinId}&jahr=${jahr}`} target="_blank" className={KNOPF}>
              <Printer size={15} /> PDF-Ansicht
            </Link>
            <a href={`${EHRUNGEN_PFAD}/export?art=jahr&verein=${verein.vereinId}&jahr=${jahr}`} className={KNOPF}>
              <FileDown size={15} /> CSV
            </a>
          </>
        }
      />
      <div className="flex items-center gap-2">
        <Link href={jahrLink(jahr - 1)} className={KNOPF}>
          ‹ {jahr - 1}
        </Link>
        <span className="text-[18px] font-extrabold text-brand-ink">🏅 Ehrungen {jahr}</span>
        <Link href={jahrLink(jahr + 1)} className={KNOPF}>
          {jahr + 1} ›
        </Link>
      </div>
      <section className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {MONATE.map((m, i) => {
          const n = eintraege.filter((v) => Number(stichtagVon(v)!.slice(5, 7)) === i + 1).length;
          return (
            <a key={m} href={n ? `#monat-${i + 1}` : undefined} className={`rounded-xl border border-brand-line bg-white p-2 text-center ${n ? "" : "opacity-60"}`}>
              <span className="block text-[11.5px] font-semibold text-brand-ink-soft">{m.slice(0, 3)}</span>
              <span className="block text-[18px] font-extrabold text-brand-ink">{n}</span>
            </a>
          );
        })}
      </section>
      <section className={KARTE}>
        <KarteKopf icon={CalendarRange} titel={`${eintraege.length} Ehrung${eintraege.length === 1 ? "" : "en"} im Jahr ${jahr}`} untertitel="Verliehen, eingeplant, gewünscht oder voraussichtlich fällig" />
        {eintraege.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Keine Ehrungen in diesem Jahr.</p>
        ) : (
          MONATE.map((m, i) => {
            const liste = eintraege.filter((v) => Number(stichtagVon(v)!.slice(5, 7)) === i + 1);
            if (!liste.length) return null;
            return (
              <div key={m} id={`monat-${i + 1}`} className="mb-4">
                <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-brand-ink-soft">
                  {m} · {liste.length} Ehrung{liste.length === 1 ? "" : "en"}
                </h3>
                <ul className="divide-y divide-brand-line rounded-xl border border-brand-line">
                  {liste.map((v) => (
                    <li key={v.id}>
                      <Link href={`${EHRUNGEN_PFAD}/${v.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-brand-bg">
                        <span className="flex min-w-0 flex-wrap items-center gap-2 text-[13.5px]">
                          <span className="font-semibold text-brand-ink">{v.personName}</span>
                          <span className="text-brand-ink">{v.auszeichnung}</span>
                          <TypBadge typ={v.typ} />
                          <span className="text-brand-ink-soft">{datum(stichtagVon(v))}</span>
                        </span>
                        <StatusBadge status={v.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
