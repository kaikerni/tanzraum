"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StatusBadge, TypBadge, HerkunftBadge } from "./Badges";
import { STATUS, STATUS_REIHENFOLGE, datum, type Status, type Vorgang } from "@/lib/ehrungen/typen";

const FILTER = "min-h-10 rounded-xl border border-brand-line bg-white px-3 text-[13px] text-brand-ink outline-none focus:border-brand-red";

export function VorgaengeListe({
  vorgaenge,
  basis,
  vorfilterStatus,
  startStatus = "",
  leerText = "Keine Ehrungen gefunden.",
}: {
  vorgaenge: Vorgang[];
  basis: string;
  vorfilterStatus?: Status[];
  startStatus?: string;
  leerText?: string;
}) {
  const [suche, setSuche] = useState("");
  const [status, setStatus] = useState<string>(startStatus);
  const [jahr, setJahr] = useState("");
  const [typ, setTyp] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [auszeichnung, setAuszeichnung] = useState("");

  const basisListe = useMemo(
    () => (vorfilterStatus ? vorgaenge.filter((v) => vorfilterStatus.includes(v.status)) : vorgaenge),
    [vorgaenge, vorfilterStatus],
  );
  const jahre = useMemo(() => [...new Set(basisListe.map((v) => v.faelligJahr).filter(Boolean))].sort() as number[], [basisListe]);
  const organisationen = useMemo(() => [...new Set(basisListe.map((v) => v.organisation).filter(Boolean))].sort() as string[], [basisListe]);
  const auszeichnungen = useMemo(() => [...new Set(basisListe.map((v) => v.auszeichnung))].sort((a, b) => a.localeCompare(b, "de")), [basisListe]);

  const liste = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return basisListe.filter(
      (v) =>
        (!s || v.personName.toLowerCase().includes(s) || v.auszeichnung.toLowerCase().includes(s)) &&
        (!status || v.status === status) &&
        (!jahr || String(v.faelligJahr) === jahr) &&
        (!typ || v.typ === typ) &&
        (!organisation || v.organisation === organisation) &&
        (!auszeichnung || v.auszeichnung === auszeichnung),
    );
  }, [basisListe, suche, status, jahr, typ, organisation, auszeichnung]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="relative sm:col-span-3 lg:col-span-2">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-faint" />
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Mitglied oder Auszeichnung suchen" aria-label="Suchen" className={`${FILTER} w-full pl-9`} />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={FILTER}>
          <option value="">Alle Status</option>
          {STATUS_REIHENFOLGE.filter((s) => !vorfilterStatus || vorfilterStatus.includes(s)).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].zeichen} {STATUS[s].label}
            </option>
          ))}
        </select>
        <select value={jahr} onChange={(e) => setJahr(e.target.value)} aria-label="Jahr" className={FILTER}>
          <option value="">Alle Jahre</option>
          {jahre.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        <select value={typ} onChange={(e) => setTyp(e.target.value)} aria-label="Art" className={FILTER}>
          <option value="">Verband & vereinsintern</option>
          <option value="verband">🏛️ Verband</option>
          <option value="verein">🏠 Vereinsintern</option>
        </select>
        <select value={organisation} onChange={(e) => setOrganisation(e.target.value)} aria-label="Verband" className={FILTER}>
          <option value="">Alle Verbände</option>
          {organisationen.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select value={auszeichnung} onChange={(e) => setAuszeichnung(e.target.value)} aria-label="Auszeichnung" className={`${FILTER} sm:col-span-3 lg:col-span-6`}>
          <option value="">Alle Auszeichnungen</option>
          {auszeichnungen.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[12.5px] text-brand-ink-soft">
        {liste.length} von {basisListe.length} Ehrung{basisListe.length === 1 ? "" : "en"}
      </p>

      {liste.length === 0 ? (
        <p className="rounded-xl bg-brand-bg px-4 py-6 text-center text-[13.5px] text-brand-ink-soft">{leerText}</p>
      ) : (
        <ul className="divide-y divide-brand-line overflow-hidden rounded-xl border border-brand-line">
          {liste.map((v) => (
            <li key={v.id}>
              <Link href={`${basis}/${v.id}`} className="grid grid-cols-1 gap-1.5 px-3.5 py-3 hover:bg-brand-bg md:grid-cols-[1.2fr_1.6fr_0.8fr_auto] md:items-center md:gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-brand-ink">{v.personName || "Ehemaliges Mitglied"}</span>
                  <span className="text-[12px] text-brand-ink-soft">
                    {v.status === "verliehen" ? `verliehen am ${datum(v.verliehenAm)}` : v.faelligAm ? `voraussichtlich ${datum(v.faelligAm)}` : "ohne Datum"}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-brand-ink">{v.auszeichnung}</span>
                  <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <TypBadge typ={v.typ} />
                    {v.organisation && <span className="truncate text-[12px] text-brand-ink-soft">{v.organisation}</span>}
                  </span>
                </span>
                <span>
                  <HerkunftBadge herkunft={v.herkunft} />
                </span>
                <span>
                  <StatusBadge status={v.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
