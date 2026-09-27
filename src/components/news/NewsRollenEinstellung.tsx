"use client";

import { useState, useTransition } from "react";
import { newsRollenSetzen } from "@/app/dashboard/news/actions";

// Vereinsadmin: welche Rollen (neben dem Admin) News/Umfragen fuer ihre eigenen Gruppen erstellen duerfen
export function NewsRollenEinstellung({ vereinId, vereinName, rollen }: { vereinId: string; vereinName: string; rollen: string[] }) {
  const [werte, setWerte] = useState(rollen);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);

  function umschalten(r: string, an: boolean) {
    const neu = an ? [...werte, r] : werte.filter((x) => x !== r);
    setWerte(neu);
    starte(async () => {
      const e = await newsRollenSetzen(vereinId, neu);
      setMeldung(e.error ?? "Gespeichert.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-brand-ink">
      <span className="font-semibold">{vereinName}:</span>
      <span className="text-brand-ink-soft">Vereinsadmins immer, außerdem</span>
      {[
        ["trainer", "Trainer/innen"],
        ["betreuer", "Betreuer/innen"],
      ].map(([k, label]) => (
        <label key={k} className="flex items-center gap-1.5">
          <input type="checkbox" checked={werte.includes(k)} disabled={laeuft} onChange={(e) => umschalten(k, e.target.checked)} /> {label}
        </label>
      ))}
      <span className="text-[12px] text-brand-ink-faint">(nur für Gruppen, die sie begleiten)</span>
      {meldung && <span className="text-[12px] text-brand-ink-soft">{meldung}</span>}
    </div>
  );
}
