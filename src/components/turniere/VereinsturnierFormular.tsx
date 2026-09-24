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
  const [tage, setTage] = useState<string[]>(turnier ? turnier.tage.map((t) => t.datum) : [""]);

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
            {KATEGORIEN.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="field">
        <span>Tage</span>
        <div className="flex flex-col gap-2">
          {tage.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="date"
                name="tage"
                value={t}
                required={i === 0}
                onChange={(e) => setTage(tage.map((x, j) => (j === i ? e.target.value : x)))}
                className="min-h-10 flex-1 rounded-xl border border-brand-line px-3 text-[13.5px]"
              />
              {tage.length > 1 && (
                <button
                  type="button"
                  aria-label="Tag entfernen"
                  onClick={() => setTage(tage.filter((_, j) => j !== i))}
                  className="inline-flex min-h-10 w-10 items-center justify-center rounded-xl border border-brand-line text-brand-ink-soft hover:text-brand-red"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {tage.length < 7 && (
            <button
              type="button"
              onClick={() => setTage([...tage, ""])}
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
      <p className="text-[12.5px] text-brand-ink-soft">Vereinsturniere sieht nur dein Verein – nicht die übrigen TanzRaum-Nutzer.</p>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gespeichert …" className="self-start">
        {turnier ? "Änderungen speichern" : "Turnier anlegen"}
      </SendenButton>
    </form>
  );
}
