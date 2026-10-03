"use client";

import { ROLLEN_LABEL, type VerfasserVerein } from "@/lib/news/getNews";

// Zielgruppen-Felder: Vereinsadmin -> Verein, Rollen, alle Gruppen; sonst nur eigene Gruppen (+ deren Eltern)
export function ZielAuswahl({ verein }: { verein: VerfasserVerein }) {
  const box = "flex items-center gap-2 text-[13.5px] text-brand-ink";
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-brand-line p-3">
      <legend className="px-1 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">An wen?</legend>
      {verein.istAdmin && (
        <label className={box}>
          <input type="checkbox" name="ziel_verein" /> Ganzer Verein
        </label>
      )}
      {verein.gruppen.length > 0 && (
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {verein.gruppen.map((g) => (
            <div key={g.id} className="flex flex-col gap-1">
              <label className={box}>
                <input type="checkbox" name="ziel_gruppe" value={g.id} /> Gruppe {g.name}
              </label>
              <label className={`${box} pl-6 text-[12.5px] text-brand-ink-soft`}>
                <input type="checkbox" name="ziel_eltern_gruppe" value={g.id} /> Eltern der Gruppe {g.name}
              </label>
            </div>
          ))}
        </div>
      )}
      {verein.istAdmin && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-brand-line pt-2">
          {Object.entries(ROLLEN_LABEL).map(([k, label]) => (
            <label key={k} className={box}>
              <input type="checkbox" name="ziel_rolle" value={k} /> {label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
