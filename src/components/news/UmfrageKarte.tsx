"use client";

import { useState, useTransition } from "react";
import { BarChart3, Lock, Square, Trash2 } from "lucide-react";
import { umfrageAbstimmen, umfrageBeenden, umfrageLoeschen } from "@/app/dashboard/news/actions";
import type { Umfrage } from "@/lib/news/getNews";

export function UmfrageKarte({ u }: { u: Umfrage }) {
  const [laeuft, starte] = useTransition();
  const [auswahl, setAuswahl] = useState<number[]>(u.meine);
  const [fehler, setFehler] = useState<string | null>(null);
  const beendet = new Date(u.endetAm).getTime() <= Date.now();
  const darfAbstimmen = u.istEmpfaenger && !beendet;
  const gesamt = u.stimmen.reduce((a, b) => a + b, 0);

  function waehle(i: number) {
    setAuswahl((alt) => (u.mehrfach ? (alt.includes(i) ? alt.filter((x) => x !== i) : [...alt, i]) : [i]));
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-brand-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-brand-ink-soft">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue-wash px-2 py-0.5 font-semibold text-brand-blue">
          <BarChart3 size={12} /> Umfrage
        </span>
        <span>{u.vereinName}</span>
        <span>·</span>
        <span>
          {beendet ? "beendet" : "läuft bis"}{" "}
          {new Date(u.endetAm).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" })}
        </span>
        {u.anonym && (
          <span className="inline-flex items-center gap-1">
            <Lock size={12} /> anonym
          </span>
        )}
      </div>
      <h3 className="text-[16.5px] font-bold text-brand-ink">{u.frage}</h3>
      {u.beschreibung && <p className="whitespace-pre-line text-[14px] text-brand-ink">{u.beschreibung}</p>}

      <ul className="flex flex-col gap-2">
        {u.optionen.map((o, i) => {
          const anteil = gesamt ? Math.round((u.stimmen[i] / gesamt) * 100) : 0;
          const gewaehlt = auswahl.includes(i);
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!darfAbstimmen || laeuft}
                onClick={() => waehle(i)}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-[14px] ${
                  gewaehlt ? "border-brand-red" : "border-brand-line"
                } ${darfAbstimmen ? "hover:border-brand-red/60" : ""}`}
              >
                <span className="absolute inset-y-0 left-0 bg-brand-red-wash" style={{ width: `${anteil}%` }} aria-hidden="true" />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="font-medium text-brand-ink">
                    {u.mehrfach ? (gewaehlt ? "☑ " : "☐ ") : gewaehlt ? "● " : "○ "}
                    {o}
                  </span>
                  <span className="text-[12.5px] text-brand-ink-soft">
                    {u.stimmen[i]} ({anteil} %)
                  </span>
                </span>
              </button>
              {u.namen && u.namen[i]?.length > 0 && <p className="mt-1 pl-3 text-[12px] text-brand-ink-soft">{u.namen[i].join(", ")}</p>}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="text-brand-ink-soft">
          {u.teilnehmer} von {u.empfaenger} haben abgestimmt
        </span>
        {darfAbstimmen && (
          <button
            type="button"
            disabled={laeuft || (auswahl.length === 0 && u.meine.length === 0)}
            onClick={() => starte(async () => setFehler((await umfrageAbstimmen(u.id, auswahl)).error))}
            className="inline-flex min-h-9 items-center rounded-lg bg-brand-red px-3 font-semibold text-white hover:bg-brand-red-deep disabled:opacity-60"
          >
            {u.meine.length ? (auswahl.length ? "Stimme ändern" : "Stimme zurücknehmen") : "Abstimmen"}
          </button>
        )}
        {u.darfVerwalten && !beendet && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => {
              if (confirm("Umfrage jetzt beenden?")) starte(async () => setFehler((await umfrageBeenden(u.id)).error));
            }}
            className="inline-flex items-center gap-1 font-semibold text-brand-ink-soft hover:text-brand-ink"
          >
            <Square size={14} /> Beenden
          </button>
        )}
        {u.darfVerwalten && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => {
              if (confirm("Umfrage mit allen Stimmen löschen?")) starte(async () => setFehler((await umfrageLoeschen(u.id)).error));
            }}
            className="inline-flex items-center gap-1 font-semibold text-brand-ink-soft hover:text-brand-red"
          >
            <Trash2 size={14} /> Löschen
          </button>
        )}
      </div>
      {fehler && <p className="form-error">{fehler}</p>}
    </article>
  );
}
