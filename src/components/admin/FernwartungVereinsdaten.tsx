"use client";

import { useActionState } from "react";
import { fernwartungVereinsdatenSpeichern } from "@/app/dashboard/admin/fernwartung/actions";
import { LEERES_ERGEBNIS, Meldung, SendenButton } from "@/components/ui/SendenButton";

const EINGABE = "w-full rounded-lg border border-brand-line bg-white px-3 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-red";
const FELDER: { k: string; label: string; breit?: boolean }[] = [
  { k: "name", label: "Vereinsname", breit: true },
  { k: "kuerzel", label: "Kürzel" },
  { k: "email", label: "E-Mail" },
  { k: "telefon", label: "Telefon" },
  { k: "webseite", label: "Webseite" },
  { k: "strasse", label: "Straße" },
  { k: "hausnummer", label: "Hausnummer" },
  { k: "plz", label: "PLZ" },
  { k: "ort", label: "Ort" },
];

export function FernwartungVereinsdaten({ vereinId, daten }: { vereinId: string; daten: Record<string, string | null> }) {
  const [ergebnis, aktion] = useActionState(fernwartungVereinsdatenSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FELDER.map((f) => (
          <label key={f.k} className={`flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft ${f.breit ? "sm:col-span-2" : ""}`}>
            {f.label}
            <input name={f.k} defaultValue={daten[f.k] ?? ""} maxLength={200} className={EINGABE} />
          </label>
        ))}
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft sm:col-span-2">
          Beschreibung
          <textarea name="beschreibung" defaultValue={daten.beschreibung ?? ""} maxLength={2000} rows={3} className={EINGABE} />
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton>Vereinsdaten speichern</SendenButton>
      </div>
    </form>
  );
}
