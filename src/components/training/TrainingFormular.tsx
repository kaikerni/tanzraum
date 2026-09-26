"use client";

import { useActionState, useState } from "react";
import { trainingAnlegen } from "@/app/dashboard/training/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { BetreuteGruppe } from "@/lib/training/getTraining";

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export function TrainingFormular({ gruppen, heute }: { gruppen: BetreuteGruppe[]; heute: string }) {
  const [ergebnis, aktion] = useActionState(trainingAnlegen, LEERES_ERGEBNIS);
  const [art, setArt] = useState<"woechentlich" | "einmalig">("woechentlich");
  const mehrereVereine = new Set(gruppen.map((g) => g.vereinId)).size > 1;

  return (
    <form action={aktion} className="flex flex-col gap-4">
      <label className="field">
        <span>Gruppe</span>
        <select name="gruppe" required defaultValue="">
          <option value="" disabled>
            Gruppe wählen …
          </option>
          {gruppen.map((g) => (
            <option key={g.gruppeId} value={`${g.gruppeId}|${g.vereinId}`}>
              {g.gruppeName}
              {mehrereVereine ? ` (${g.vereinName})` : ""}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12.5px] font-semibold text-brand-ink-soft">Art</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["woechentlich", "Jede Woche"],
              ["einmalig", "Einmalig"],
            ] as const
          ).map(([wert, label]) => (
            <label
              key={wert}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-[13.5px] font-semibold ${
                art === wert ? "border-brand-red bg-brand-red-wash text-brand-red-deep" : "border-brand-line bg-white text-brand-ink"
              }`}
            >
              <input type="radio" name="art" value={wert} checked={art === wert} onChange={() => setArt(wert)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {art === "woechentlich" ? (
        <label className="field">
          <span>Wochentag</span>
          <select name="wochentag" required defaultValue="">
            <option value="" disabled>
              Wochentag wählen …
            </option>
            {WOCHENTAGE.map((t, i) => (
              <option key={t} value={i + 1}>
                {t}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="field">
          <span>Datum</span>
          <input type="date" name="datum" min={heute} required />
        </label>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="field">
          <span>Beginn</span>
          <input type="time" name="von" required />
        </label>
        <label className="field">
          <span>Ende</span>
          <input type="time" name="bis" required />
        </label>
      </div>
      <label className="field">
        <span>Halle / Ort</span>
        <input name="halle" placeholder="z. B. Sporthalle Zeiskam" />
      </label>
      <label className="field">
        <span>Titel (optional)</span>
        <input name="titel" placeholder="z. B. Sondertraining Marsch" />
      </label>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton laedtText="Wird angelegt …">Training anlegen</SendenButton>
      </div>
    </form>
  );
}
