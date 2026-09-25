"use client";

import { useActionState, useState } from "react";
import { mapEinstellungenSpeichern } from "@/app/dashboard/netzwerk/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export type MapStand = { mapSichtbar: boolean; ort: string | null; unter15: boolean; elternErlauben: boolean; wirdAngezeigt: boolean };

export function MapEinstellungen({ stand }: { stand: MapStand }) {
  const [ergebnis, aktion] = useActionState(mapEinstellungenSpeichern, LEERES_ERGEBNIS);
  const [sichtbar, setSichtbar] = useState(stand.mapSichtbar);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <label className="field">
        <span>Ort oder Region</span>
        <input name="ort" defaultValue={stand.ort ?? ""} placeholder="z. B. 68159 Mannheim" maxLength={80} autoComplete="address-level2" />
        <small className="text-[12px] text-brand-ink-soft">Nie deine Adresse eintragen – angezeigt wird nur der Ort (auf etwa 1 km gerundet).</small>
      </label>
      {stand.unter15 ? (
        <p className="rounded-xl bg-brand-bg px-3 py-2.5 text-[13px] text-brand-ink-soft">
          🗺️ Unter 15 Jahren erscheinst du nur auf der Map, wenn ein verknüpftes Elternteil das erlaubt.
          {stand.elternErlauben ? " Deine Eltern haben es erlaubt." : " Aktuell wirst du nicht angezeigt."}
        </p>
      ) : (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[13.5px] font-semibold text-brand-ink">🗺️ Auf der TanzRaum Map anzeigen</legend>
          <div className="flex gap-2">
            {[
              [true, "🟢 Ja"],
              [false, "🔴 Nein"],
            ].map(([wert, label]) => (
              <label
                key={String(wert)}
                className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-xl border text-[13.5px] font-semibold sm:flex-none sm:px-6 ${
                  sichtbar === wert ? "border-brand-red bg-brand-red-wash text-brand-ink" : "border-brand-line text-brand-ink-soft"
                }`}
              >
                <input type="radio" name="sichtbar" value={wert ? "ja" : "nein"} checked={sichtbar === wert} onChange={() => setSichtbar(wert as boolean)} className="sr-only" />
                {label as string}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="text-[12.5px] text-brand-ink-soft">
        Status: {stand.wirdAngezeigt ? "Du bist auf der Map zu sehen." : "Du bist nicht auf der Map zu sehen."} Private Konten erscheinen nie auf der Map.
      </p>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gespeichert …" className="self-start">
        Speichern
      </SendenButton>
    </form>
  );
}
