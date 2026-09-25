"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, MapPin, ExternalLink, CalendarDays, List, LayoutGrid } from "lucide-react";
import type { EintragTyp, KalenderEintrag } from "@/lib/kalender/getKalender";

type Filter = "training" | "verein" | "turnier" | "privat";

const FILTER: { wert: Filter; label: string; punkt: string }[] = [
  { wert: "training", label: "Training", punkt: "bg-brand-green" },
  { wert: "verein", label: "Vereinstermine", punkt: "bg-brand-blue" },
  { wert: "turnier", label: "Turniere", punkt: "bg-brand-gold" },
  { wert: "privat", label: "Privat", punkt: "bg-brand-navy-soft" },
];

const STIL: Record<EintragTyp, { pille: string; punkt: string; label: string }> = {
  training: { pille: "bg-brand-green-wash text-brand-green", punkt: "bg-brand-green", label: "Training" },
  termin: { pille: "bg-brand-blue-wash text-brand-blue", punkt: "bg-brand-blue", label: "Termin" },
  sitzung: { pille: "bg-brand-purple-wash text-brand-purple", punkt: "bg-brand-purple", label: "Sitzung" },
  turnier: { pille: "bg-brand-gold-wash text-brand-gold", punkt: "bg-brand-gold", label: "Turnier" },
  privat: { pille: "bg-brand-bg text-brand-navy-soft", punkt: "bg-brand-navy-soft", label: "Privat" },
};

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const SPEICHER = "tanzraum-kalender-filter";

function filterVon(typ: EintragTyp): Filter {
  return typ === "termin" || typ === "sitzung" ? "verein" : typ;
}

function plusTage(iso: string, tage: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

function langesDatum(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function zeitText(e: KalenderEintrag) {
  if (!e.von) return "ganztägig";
  return e.bis ? `${e.von}–${e.bis} Uhr` : `ab ${e.von} Uhr`;
}

function EintragKarte({ e }: { e: KalenderEintrag }) {
  const stil = STIL[e.typ];
  const inhalt = (
    <>
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${stil.punkt}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-[14px] font-semibold text-brand-ink ${e.hinweis === "abgemeldet" ? "line-through decoration-brand-ink-faint" : ""}`}>
            {e.titel}
          </span>
          {e.hinweis && (
            <span className={`status-badge ${e.hinweis === "abgemeldet" ? "abgesagt" : "offen"}`}>{e.hinweis}</span>
          )}
        </div>
        {e.untertitel && <div className="mt-0.5 text-[12.5px] text-brand-ink-soft">{e.untertitel}</div>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-brand-ink">
          <span className="flex items-center gap-1">
            <Clock size={13} className="text-brand-ink-soft" /> {zeitText(e)}
          </span>
          {e.ort && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={13} className="shrink-0 text-brand-ink-soft" /> <span className="truncate">{e.ort}</span>
            </span>
          )}
        </div>
      </div>
      {e.href && e.extern && <ExternalLink size={15} className="mt-1 shrink-0 text-brand-ink-faint" aria-label="Öffnet die Ausschreibung" />}
      {e.href && !e.extern && <ChevronRight size={16} className="mt-1 shrink-0 text-brand-ink-faint" aria-hidden />}
    </>
  );
  const klasse = "flex items-start gap-3 rounded-xl border border-brand-line bg-white px-3.5 py-3";
  if (!e.href) return <div className={klasse}>{inhalt}</div>;
  return e.extern ? (
    <a href={e.href} target="_blank" rel="noopener noreferrer" className={`${klasse} hover:bg-brand-bg`}>
      {inhalt}
    </a>
  ) : (
    <Link href={e.href} className={`${klasse} hover:bg-brand-bg`}>
      {inhalt}
    </Link>
  );
}

export function KalenderMonat({
  monat,
  rasterVon,
  eintraege,
  heute,
  vorherMonat,
  naechsterMonat,
  startTag,
}: {
  monat: string;
  rasterVon: string;
  eintraege: KalenderEintrag[];
  heute: string;
  vorherMonat: string;
  naechsterMonat: string;
  startTag: string | null;
}) {
  const [aktiv, setAktiv] = useState<Set<Filter>>(new Set(FILTER.map((f) => f.wert)));
  const [ansicht, setAnsicht] = useState<"monat" | "liste">("monat");
  const standardTag = startTag ?? (heute.startsWith(monat) ? heute : (eintraege.find((e) => e.datum.startsWith(monat))?.datum ?? `${monat}-01`));
  const [tag, setTag] = useState(standardTag);

  useEffect(() => {
    try {
      const gespeichert = JSON.parse(localStorage.getItem(SPEICHER) ?? "null");
      if (Array.isArray(gespeichert)) setAktiv(new Set(gespeichert.filter((f) => FILTER.some((x) => x.wert === f))));
      if (localStorage.getItem(`${SPEICHER}-ansicht`) === "liste") setAnsicht("liste");
    } catch {
      /* ohne Speicher: Standardfilter */
    }
  }, []);

  function umschalten(f: Filter) {
    const neu = new Set(aktiv);
    if (neu.has(f)) neu.delete(f);
    else neu.add(f);
    setAktiv(neu);
    try {
      localStorage.setItem(SPEICHER, JSON.stringify([...neu]));
    } catch {
      /* egal */
    }
  }

  function ansichtWaehlen(a: "monat" | "liste") {
    setAnsicht(a);
    try {
      localStorage.setItem(`${SPEICHER}-ansicht`, a);
    } catch {
      /* egal */
    }
  }

  const sichtbar = useMemo(() => eintraege.filter((e) => aktiv.has(filterVon(e.typ))), [eintraege, aktiv]);

  const nachTag = useMemo(() => {
    const karte = new Map<string, KalenderEintrag[]>();
    for (const e of sichtbar) {
      let d = e.datum;
      const ende = e.bisDatum ?? e.datum;
      for (let i = 0; d <= ende && i < 60; i++, d = plusTage(d, 1)) {
        karte.set(d, [...(karte.get(d) ?? []), e]);
      }
    }
    return karte;
  }, [sichtbar]);

  const anzahl = (f: Filter) => eintraege.filter((e) => filterVon(e.typ) === f && e.datum.startsWith(monat)).length;
  const tage = Array.from({ length: 42 }, (_, i) => plusTage(rasterVon, i));
  const wochen = tage[35].startsWith(monat) ? 6 : 5;
  const monatsName = new Date(`${monat}-01T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  const tagesListe = nachTag.get(tag) ?? [];
  const monatsTage = [...nachTag.keys()].filter((d) => d.startsWith(monat)).sort();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white p-3 shadow-[var(--shadow)] sm:p-4">
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/kalender?monat=${vorherMonat}`}
            aria-label="Vorheriger Monat"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-brand-ink hover:bg-brand-bg"
          >
            <ChevronLeft size={20} />
          </Link>
          <h2 className="min-w-[150px] text-center text-[17px] font-bold capitalize text-brand-ink">{monatsName}</h2>
          <Link
            href={`/dashboard/kalender?monat=${naechsterMonat}`}
            aria-label="Nächster Monat"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-brand-ink hover:bg-brand-bg"
          >
            <ChevronRight size={20} />
          </Link>
          {!heute.startsWith(monat) && (
            <Link href="/dashboard/kalender" className="ml-1 rounded-xl border border-brand-line px-3 py-2 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg">
              Heute
            </Link>
          )}
        </div>
        <div className="flex rounded-xl bg-brand-bg p-1" role="group" aria-label="Ansicht">
          {(
            [
              ["monat", "Monat", LayoutGrid],
              ["liste", "Liste", List],
            ] as const
          ).map(([wert, label, Icon]) => (
            <button
              key={wert}
              type="button"
              aria-pressed={ansicht === wert}
              onClick={() => ansichtWaehlen(wert)}
              className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${
                ansicht === wert ? "bg-white text-brand-ink shadow-sm" : "text-brand-ink-soft"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-0.5">
          {FILTER.map((f) => (
            <button
              key={f.wert}
              type="button"
              aria-pressed={aktiv.has(f.wert)}
              onClick={() => umschalten(f.wert)}
              className={`flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[12.5px] font-semibold ${
                aktiv.has(f.wert) ? "border-brand-ink/15 bg-white text-brand-ink" : "border-brand-line bg-brand-bg text-brand-ink-faint"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${aktiv.has(f.wert) ? f.punkt : "bg-brand-ink-faint/40"}`} />
              {f.label}
              <span className="text-brand-ink-faint">{anzahl(f.wert)}</span>
            </button>
          ))}
        </div>
      </div>

      {ansicht === "liste" ? (
        <section className="flex flex-col gap-4">
          {monatsTage.length === 0 ? (
            <p className="rounded-[var(--radius-l)] border border-brand-line bg-white p-5 text-[14px] text-brand-ink-soft shadow-[var(--shadow)]">
              In diesem Monat gibt es keine Einträge für die gewählten Filter.
            </p>
          ) : (
            monatsTage.map((d) => (
              <div key={d}>
                <h3 className={`mb-2 text-[13.5px] font-bold ${d === heute ? "text-brand-red" : "text-brand-ink"}`}>
                  {d === heute ? "Heute · " : ""}
                  {langesDatum(d)}
                </h3>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {(nachTag.get(d) ?? []).map((e) => (
                    <EintragKarte key={e.schluessel} e={e} />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)]">
            <div className="grid grid-cols-7 border-b border-brand-line bg-brand-bg/60">
              {WOCHENTAGE.map((w) => (
                <div key={w} className="py-2 text-center text-[11.5px] font-semibold uppercase tracking-wide text-brand-ink-soft">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {tage.slice(0, wochen * 7).map((d, i) => {
                const liste = nachTag.get(d) ?? [];
                const imMonat = d.startsWith(monat);
                const gewaehlt = d === tag;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTag(d)}
                    aria-pressed={gewaehlt}
                    aria-label={`${langesDatum(d)}${liste.length ? `, ${liste.length} Einträge` : ""}`}
                    className={`flex min-h-[58px] flex-col items-stretch gap-1 border-brand-line p-1 text-left sm:min-h-[76px] md:min-h-[100px] md:p-1.5 ${
                      i % 7 !== 6 ? "border-r" : ""
                    } ${i < (wochen - 1) * 7 ? "border-b" : ""} ${gewaehlt ? "bg-brand-red-wash/60" : imMonat ? "hover:bg-brand-bg" : "bg-brand-bg/50"}`}
                  >
                    <span
                      className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] font-semibold md:mx-0 ${
                        d === heute ? "bg-brand-red text-white" : imMonat ? "text-brand-ink" : "text-brand-ink-faint"
                      }`}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {liste.length > 0 && (
                      <>
                        <span className="flex flex-wrap justify-center gap-0.5 md:hidden">
                          {liste.slice(0, 4).map((e) => (
                            <span key={e.schluessel} className={`h-1.5 w-1.5 rounded-full ${STIL[e.typ].punkt}`} />
                          ))}
                        </span>
                        <span className="hidden flex-col gap-0.5 md:flex">
                          {liste.slice(0, 3).map((e) => (
                            <span
                              key={e.schluessel}
                              className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight ${STIL[e.typ].pille} ${
                                e.hinweis === "abgemeldet" ? "line-through opacity-60" : ""
                              }`}
                            >
                              {e.von ? `${e.von} ` : ""}
                              {e.titel}
                            </span>
                          ))}
                          {liste.length > 3 && <span className="px-1 text-[11px] font-medium text-brand-ink-soft">+{liste.length - 3} weitere</span>}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
            <h3 className={`flex items-center gap-2 text-[14px] font-bold ${tag === heute ? "text-brand-red" : "text-brand-ink"}`}>
              <CalendarDays size={17} />
              {tag === heute ? "Heute · " : ""}
              {langesDatum(tag)}
            </h3>
            {tagesListe.length === 0 ? (
              <p className="rounded-xl border border-brand-line bg-white px-3.5 py-3 text-[13px] text-brand-ink-soft">
                Keine Einträge an diesem Tag.
              </p>
            ) : (
              tagesListe.map((e) => <EintragKarte key={e.schluessel} e={e} />)
            )}
            <Link
              href={`/dashboard/kalender/neu?datum=${tag}`}
              className="mt-1 inline-flex min-h-10 items-center justify-center rounded-xl border border-dashed border-brand-line bg-white text-[13px] font-semibold text-brand-ink-soft hover:border-brand-red hover:text-brand-red"
            >
              + Termin an diesem Tag
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
