"use client";

import { useState, useTransition } from "react";
import { abmelden } from "@/app/dashboard/training/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { ABMELDEGRUENDE } from "@/lib/training/abmeldegruende";

const KNOPF =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold disabled:opacity-60";

// Abmeldung mit festem Grund + optionalem Hinweis. Wer eintraegt (selbst/Eltern/Trainer), bestimmt die Datenbank.
export function AbmeldeFormular({
  vereinId,
  gruppeId,
  datum,
  vmId,
  idPraefix,
  manuell,
  onFertig,
  onAbbrechen,
}: {
  vereinId: string;
  gruppeId: string;
  datum: string;
  vmId: string;
  idPraefix: string;
  manuell?: boolean;
  onFertig: (ergebnis: AktionsErgebnis) => void;
  onAbbrechen: () => void;
}) {
  const [laeuft, starte] = useTransition();
  const [kategorie, setKategorie] = useState("");
  const [hinweis, setHinweis] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!kategorie) {
          setFehler("Bitte einen Grund auswählen.");
          return;
        }
        starte(async () => {
          const ergebnis = await abmelden(
            vereinId,
            gruppeId,
            datum,
            vmId,
            kategorie,
            hinweis,
          );
          if (ergebnis.error) setFehler(ergebnis.error);
          else onFertig(ergebnis);
        });
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`${idPraefix}-kategorie`}>
          Grund
        </label>
        <select
          id={`${idPraefix}-kategorie`}
          value={kategorie}
          onChange={(e) => {
            setKategorie(e.target.value);
            setFehler(null);
          }}
          required
          className="min-h-10 rounded-xl border border-brand-line bg-white px-3 text-[13.5px] outline-none focus:border-brand-red"
        >
          <option value="" disabled>
            Grund wählen
          </option>
          {ABMELDEGRUENDE.map((g) => (
            <option key={g.wert} value={g.wert}>
              {g.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${idPraefix}-hinweis`}>
          Hinweis (optional)
        </label>
        <input
          id={`${idPraefix}-hinweis`}
          value={hinweis}
          onChange={(e) => setHinweis(e.target.value)}
          maxLength={200}
          placeholder={
            manuell
              ? "Hinweis (optional), z. B. per WhatsApp"
              : "Hinweis (optional)"
          }
          className="min-h-10 flex-1 rounded-xl border border-brand-line bg-white px-3 text-[13.5px] outline-none focus:border-brand-red"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={laeuft}
          className={`${KNOPF} border-brand-red bg-brand-red text-white hover:bg-brand-red-deep`}
        >
          {manuell ? "Abmeldung eintragen" : "Abmelden"}
        </button>
        <button
          type="button"
          onClick={onAbbrechen}
          className={`${KNOPF} border-brand-line bg-white text-brand-ink-soft`}
        >
          Abbrechen
        </button>
      </div>
      {fehler && <p className="form-error">{fehler}</p>}
    </form>
  );
}
