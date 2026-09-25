"use client";

import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowDownAZ, Search } from "lucide-react";

export type ListenEintrag = { id: string; name: string; seit: string | null; inhalt: React.ReactNode };

// Liste mit Schalter "Neueste zuerst" / "Name A–Z" und Namensfilter (alles im Browser, Daten kommen vom Server)
export function SortierteListe({ eintraege, leer = "Keine Einträge.", suchText = "Nach Namen filtern …" }: { eintraege: ListenEintrag[]; leer?: string; suchText?: string }) {
  const [sortierung, setSortierung] = useState<"neu" | "name">("neu");
  const [filter, setFilter] = useState("");

  const liste = useMemo(() => {
    const f = filter.trim().toLocaleLowerCase("de");
    const gefiltert = f ? eintraege.filter((e) => e.name.toLocaleLowerCase("de").includes(f)) : eintraege;
    return [...gefiltert].sort((a, b) =>
      sortierung === "name" ? a.name.localeCompare(b.name, "de", { sensitivity: "base" }) : (b.seit ?? "").localeCompare(a.seit ?? ""),
    );
  }, [eintraege, sortierung, filter]);

  const knopf = (aktiv: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${aktiv ? "bg-brand-red text-white" : "text-brand-ink-soft"}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-brand-line bg-white p-1 text-[13px]">
          <button type="button" className={knopf(sortierung === "neu")} onClick={() => setSortierung("neu")}>
            <ArrowDownWideNarrow size={14} /> Neueste zuerst
          </button>
          <button type="button" className={knopf(sortierung === "name")} onClick={() => setSortierung("name")}>
            <ArrowDownAZ size={14} /> Name A–Z
          </button>
        </div>
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-brand-line bg-white px-3 py-1.5 text-[13.5px]">
          <Search size={15} className="text-brand-ink-soft" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={suchText} className="w-full bg-transparent outline-none" />
        </label>
        <span className="text-[12.5px] text-brand-ink-soft">{liste.length} von {eintraege.length}</span>
      </div>
      {liste.length === 0 ? (
        <p className="text-[13.5px] text-brand-ink-soft">{leer}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-brand-line rounded-xl border border-brand-line bg-white">
          {liste.map((e) => (
            <li key={e.id}>{e.inhalt}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
