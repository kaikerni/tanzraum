"use client";

import { useState, useTransition } from "react";
import { Trash2, Repeat, CalendarDays } from "lucide-react";
import { trainingLoeschen } from "@/app/dashboard/training/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { TrainingsSerie } from "@/lib/training/getTraining";

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export function TrainingsSerien({ serien }: { serien: TrainingsSerie[] }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);

  if (serien.length === 0) {
    return <p className="text-[13px] text-brand-ink-soft">Noch keine Trainingszeiten angelegt.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-brand-line">
        {serien.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5">
            {s.wiederholend ? (
              <Repeat size={16} className="shrink-0 text-brand-ink-soft" aria-label="wöchentlich" />
            ) : (
              <CalendarDays size={16} className="shrink-0 text-brand-ink-soft" aria-label="einmalig" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-brand-ink">
                {s.gruppeName}
                {s.titel ? ` · ${s.titel}` : ""}
              </div>
              <div className="text-[12.5px] text-brand-ink-soft">
                {s.wiederholend
                  ? `jeden ${WOCHENTAGE[(s.wochentag ?? 1) - 1]}`
                  : new Date(`${s.datum}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" })}
                , {s.von}–{s.bis} Uhr{s.halle ? ` · ${s.halle}` : ""}
              </div>
            </div>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => {
                if (
                  confirm(
                    "Trainingszeit wirklich löschen? Zukünftige Termine dieser Zeit verschwinden aus dem Kalender. Bereits erfasste Anwesenheiten bleiben erhalten.",
                  )
                ) {
                  starte(async () => setMeldung(await trainingLoeschen(s.id)));
                }
              }}
              aria-label="Trainingszeit löschen"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-red/30 text-brand-red hover:bg-brand-red-wash"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="text-[13px] text-brand-green">{meldung.ok}</p>}
    </div>
  );
}
