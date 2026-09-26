"use client";

import { useState, useTransition } from "react";
import { Check, X, CheckCheck, Save } from "lucide-react";
import { anwesenheitSpeichern } from "@/app/dashboard/training/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { AnwesenheitsEintrag } from "@/lib/training/getTraining";

// Grosse Tippflaechen fuers Handy: pro Person "Da" / "Fehlt"; Abgemeldete sind vorbelegt mit "Fehlt".
export function AnwesenheitErfassung({
  vereinId,
  gruppeId,
  datum,
  eintraege,
}: {
  vereinId: string;
  gruppeId: string;
  datum: string;
  eintraege: AnwesenheitsEintrag[];
}) {
  const [status, setStatus] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(eintraege.map((e) => [e.vmId, e.anwesend ?? (e.abgemeldet ? false : null)])),
  );
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);

  const da = Object.values(status).filter((s) => s === true).length;
  const offen = Object.values(status).filter((s) => s === null).length;

  function setze(vmId: string, wert: boolean) {
    setMeldung(null);
    setStatus((alt) => ({ ...alt, [vmId]: wert }));
  }

  if (eintraege.length === 0) {
    return <p className="text-[13.5px] text-brand-ink-soft">Dieser Gruppe sind noch keine Teilnehmer zugeordnet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-brand-ink">
          <strong>{da}</strong> von {eintraege.length} da{offen > 0 ? ` · ${offen} ohne Eintrag` : ""}
        </p>
        <button
          type="button"
          onClick={() =>
            setStatus((alt) =>
              Object.fromEntries(eintraege.map((e) => [e.vmId, e.abgemeldet ? (alt[e.vmId] ?? false) : true])),
            )
          }
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-green/40 bg-brand-green-wash px-4 text-[13.5px] font-semibold text-brand-green hover:brightness-95"
        >
          <CheckCheck size={17} /> Alle Anwesenden markieren
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {eintraege.map((e) => {
          const s = status[e.vmId];
          return (
            <li key={e.vmId} className="flex items-center gap-3 rounded-xl border border-brand-line bg-white px-3 py-2.5">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ${s === true ? "bg-brand-green" : s === false ? "bg-brand-red" : "bg-brand-amber"}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-brand-ink">{e.name}</div>
                <div className="text-[12px] text-brand-ink-soft">
                  {e.abgemeldet ? `Abgemeldet${e.grund ? `: ${e.grund}` : ""}` : s === null ? "Keine Rückmeldung" : s ? "Anwesend" : "Fehlt"}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Anwesenheit ${e.name}`}>
                <button
                  type="button"
                  onClick={() => setze(e.vmId, true)}
                  aria-pressed={s === true}
                  className={`flex h-11 min-w-[52px] items-center justify-center gap-1 rounded-xl border px-2 text-[13px] font-semibold ${
                    s === true ? "border-brand-green bg-brand-green text-white" : "border-brand-line bg-white text-brand-ink"
                  }`}
                >
                  <Check size={16} /> Da
                </button>
                <button
                  type="button"
                  onClick={() => setze(e.vmId, false)}
                  aria-pressed={s === false}
                  className={`flex h-11 min-w-[52px] items-center justify-center gap-1 rounded-xl border px-2 text-[13px] font-semibold ${
                    s === false ? "border-brand-red bg-brand-red text-white" : "border-brand-line bg-white text-brand-ink"
                  }`}
                >
                  <X size={16} /> Fehlt
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-20 z-10 flex flex-col gap-2 md:bottom-2">
        {meldung?.error && <p className="form-error">{meldung.error}</p>}
        {meldung?.ok && <p className="rounded-lg bg-brand-green-wash px-3 py-2 text-[13px] text-brand-green">{meldung.ok}</p>}
        <button
          type="button"
          disabled={laeuft}
          onClick={() =>
            starte(async () =>
              setMeldung(
                await anwesenheitSpeichern(
                  vereinId,
                  gruppeId,
                  datum,
                  Object.entries(status)
                    .filter(([, wert]) => wert !== null)
                    .map(([vmId, wert]) => ({ vmId, anwesend: wert as boolean })),
                ),
              ),
            )
          }
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-red text-[15px] font-bold text-white shadow-[var(--shadow-hover)] hover:bg-brand-red-deep disabled:opacity-60"
        >
          <Save size={18} /> {laeuft ? "Wird gespeichert …" : "Anwesenheit speichern"}
        </button>
      </div>
    </div>
  );
}
