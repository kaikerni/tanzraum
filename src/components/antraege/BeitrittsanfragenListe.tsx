"use client";

import { useState, useTransition } from "react";
import { beitrittsanfrageEntscheiden } from "@/app/dashboard/verein/actions";

export type Beitrittsanfrage = { id: string; name: string; geschlecht: string | null; nachricht: string | null; erstelltAm: string };
type Rolle = { id: string; name: string };

// Selbst gestellte Beitrittsanfragen: annehmen (mit Rolle) oder ablehnen. Vereinsadmin wird man nie über eine Anfrage.
function Zeile({ a, rollen }: { a: Beitrittsanfrage; rollen: Rolle[] }) {
  const vorschlag = rollen.find((r) => r.name === (a.geschlecht === "weiblich" ? "Tänzerin" : "Tänzer"))?.id ?? "";
  const [rolle, setRolle] = useState(vorschlag);
  const [laeuft, starte] = useTransition();
  const [ergebnis, setErgebnis] = useState<{ text: string; fehler: boolean } | null>(null);
  if (ergebnis && !ergebnis.fehler) return <li className="py-2.5 text-[13.5px] font-semibold text-brand-green">{a.name}: {ergebnis.text}</li>;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div>
        <p className="text-[14.5px] font-bold text-brand-ink [overflow-wrap:anywhere]">{a.name}</p>
        <p className="text-[12.5px] text-brand-ink-soft">angefragt am {new Date(a.erstelltAm).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}</p>
        {a.nachricht && <p className="mt-1 whitespace-pre-line text-[13.5px] text-brand-ink [overflow-wrap:anywhere]">„{a.nachricht}“</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={rolle} onChange={(e) => setRolle(e.target.value)} aria-label="Rolle" className="min-h-10 rounded-xl border border-brand-line bg-white px-3 text-[13.5px]">
          {rollen.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => starte(async () => {
            const r = await beitrittsanfrageEntscheiden(a.id, true, rolle);
            setErgebnis({ text: r.error ?? r.ok ?? "", fehler: !!r.error });
          })}
          className="inline-flex min-h-10 items-center rounded-xl bg-brand-green px-4 text-[13.5px] font-semibold text-white disabled:opacity-60"
        >
          Annehmen
        </button>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => {
            if (confirm(`Beitrittsanfrage von ${a.name} ablehnen?`)) starte(async () => {
              const r = await beitrittsanfrageEntscheiden(a.id, false, null);
              setErgebnis({ text: r.error ?? r.ok ?? "", fehler: !!r.error });
            });
          }}
          className="inline-flex min-h-10 items-center rounded-xl border border-brand-line px-4 text-[13.5px] font-semibold text-brand-ink disabled:opacity-60"
        >
          Ablehnen
        </button>
      </div>
      {ergebnis?.fehler && <p className="form-error">{ergebnis.text}</p>}
    </li>
  );
}

export function BeitrittsanfragenListe({ anfragen, rollen }: { anfragen: Beitrittsanfrage[]; rollen: Rolle[] }) {
  return (
    <ul className="flex flex-col divide-y divide-brand-line">
      {anfragen.map((a) => (
        <Zeile key={a.id} a={a} rollen={rollen} />
      ))}
    </ul>
  );
}
