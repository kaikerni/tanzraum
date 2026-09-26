"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { vereinsturnierSpeichern } from "@/app/dashboard/turniere/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { Turnier } from "@/lib/turniere/getTurniere";

const KATEGORIEN = ["Turnier", "Freundschaftsturnier", "Meisterschaft", "Qualifikation", "Workshop", "Sonstiges"];

export function VereinsturnierFormular({
  vereine,
  vorauswahl,
  turnier,
}: {
  vereine: { vereinId: string; vereinName: string }[];
  vorauswahl?: string | null;
  turnier?: Turnier;
}) {
  const [ergebnis, aktion] = useActionState(vereinsturnierSpeichern, LEERES_ERGEBNIS);
  const [tage, setTage] = useState<{ datum: string; beginn: string }[]>(
    turnier ? turnier.tage.map((t) => ({ datum: t.datum, beginn: t.beginn ?? "" })) : [{ datum: "", beginn: "" }],
  );
  const katalog = !!turnier && !turnier.vereinId;
  const kategorien = turnier?.kategorie && !KATEGORIEN.includes(turnier.kategorie) ? [turnier.kategorie, ...KATEGORIEN] : KATEGORIEN;

  return (
    <form action={aktion} className="flex flex-col gap-3">
      {turnier ? (
        <input type="hidden" name="turnier_id" value={turnier.id} />
      ) : vereine.length === 1 ? (
        <input type="hidden" name="verein_id" value={vereine[0].vereinId} />
      ) : (
        <label className="field">
          <span>Verein</span>
          <select name="verein_id" defaultValue={vorauswahl ?? vereine[0]?.vereinId} required>
            {vereine.map((v) => (
              <option key={v.vereinId} value={v.vereinId}>
                {v.vereinName}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={turnier?.name ?? ""} required maxLength={200} placeholder="z. B. Freundschaftsturnier TSV Musterstadt" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Ort / Halle</span>
          <input name="ort" defaultValue={turnier?.ort ?? ""} required maxLength={200} />
        </label>
        <label className="field">
          <span>Adresse</span>
          <input name="adresse" defaultValue={turnier?.adresse ?? ""} maxLength={300} placeholder="Straße, PLZ Ort" />
        </label>
        <label className="field">
          <span>Ausrichter</span>
          <input name="ausrichter" defaultValue={turnier?.ausrichter ?? ""} maxLength={200} />
        </label>
        <label className="field">
          <span>Art</span>
          <select name="kategorie" defaultValue={turnier?.kategorie ?? "Turnier"}>
            {kategorien.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="field">
        <span>Tage und Beginn</span>
        <div className="flex flex-col gap-2">
          {tage.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="date"
                name="tage"
                value={t.datum}
                required={i === 0}
                aria-label={`Tag ${i + 1}`}
                onChange={(e) => setTage(tage.map((x, j) => (j === i ? { ...x, datum: e.target.value } : x)))}
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-brand-line px-3 text-[13.5px]"
              />
              <input
                type="time"
                name="beginn"
                value={t.beginn}
                aria-label={`Beginn Tag ${i + 1} (optional)`}
                title="Beginn laut Ausschreibung (optional)"
                onChange={(e) => setTage(tage.map((x, j) => (j === i ? { ...x, beginn: e.target.value } : x)))}
                className="min-h-10 w-28 rounded-xl border border-brand-line px-2 text-[13.5px]"
              />
              {tage.length > 1 && (
                <button
                  type="button"
                  aria-label="Tag entfernen"
                  onClick={() => setTage(tage.filter((_, j) => j !== i))}
                  className="inline-flex min-h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-line text-brand-ink-soft hover:text-brand-red"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          <p className="text-[12px] font-normal text-brand-ink-faint">Beginn optional – eintragen, sobald die Ausschreibung vorliegt.</p>
          {tage.length < 7 && (
            <button
              type="button"
              onClick={() => setTage([...tage, { datum: "", beginn: "" }])}
              className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-brand-red"
            >
              <Plus size={14} /> Weiteren Tag hinzufügen
            </button>
          )}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Meldeschluss (optional)</span>
          <input type="date" name="meldeschluss" defaultValue={turnier?.meldeschluss ?? ""} />
        </label>
        <label className="field">
          <span>Link zur Ausschreibung (optional)</span>
          <input type="url" name="ausschreibung_url" defaultValue={turnier?.ausschreibungUrl ?? ""} placeholder="https://…" />
        </label>
      </div>
      <p className="text-[12.5px] text-brand-ink-soft">
        {katalog
          ? "Änderungen am Turnierkalender sehen alle TanzRaum-Nutzer."
          : "Vereinsturniere sieht nur dein Verein – nicht die übrigen TanzRaum-Nutzer."}
      </p>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gespeichert …" className="self-start">
        {turnier ? "Änderungen speichern" : "Turnier anlegen"}
      </SendenButton>
    </form>
  );
}
