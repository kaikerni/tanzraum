"use client";

import { useActionState } from "react";
import { vereinsdatenSpeichern } from "@/app/dashboard/verein/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { Auswahl, VereinsDetails } from "@/lib/verein/getVerein";

function Feld({
  label,
  name,
  wert,
  typ = "text",
  pflicht = false,
  className = "",
}: {
  label: string;
  name: string;
  wert: string | null;
  typ?: string;
  pflicht?: boolean;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <input type={typ} name={name} defaultValue={wert ?? ""} required={pflicht} />
    </label>
  );
}

export function VereinsdatenFormular({ verein, verbaende }: { verein: VereinsDetails; verbaende: Auswahl[] }) {
  const [ergebnis, aktion] = useActionState(vereinsdatenSpeichern, LEERES_ERGEBNIS);

  return (
    <form action={aktion} className="flex flex-col gap-4">
      <input type="hidden" name="verein_id" value={verein.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <Feld label="Vereinsname" name="name" wert={verein.name} pflicht />
        <Feld label="Kürzel" name="kuerzel" wert={verein.kuerzel} />
      </div>
      <label className="field">
        <span>Verband</span>
        <select name="verband_id" defaultValue={verein.verbandId ?? ""}>
          <option value="">– kein Verband –</option>
          {verbaende.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Beschreibung</span>
        <textarea
          name="beschreibung"
          defaultValue={verein.beschreibung ?? ""}
          rows={3}
          className="rounded-lg border border-brand-line px-3 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-red"
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Feld label="Ansprechpartner" name="ansprechpartner" wert={verein.ansprechpartner} />
        <Feld label="E-Mail" name="email" wert={verein.email} typ="email" />
        <Feld label="Telefon" name="telefon" wert={verein.telefon} typ="tel" />
        <Feld label="Webseite" name="webseite" wert={verein.webseite} typ="url" />
      </div>
      <div className="grid grid-cols-[3fr_1fr] gap-4">
        <Feld label="Straße" name="strasse" wert={verein.strasse} />
        <Feld label="Nr." name="hausnummer" wert={verein.hausnummer} />
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <Feld label="PLZ" name="plz" wert={verein.plz} />
        <Feld label="Ort" name="ort" wert={verein.ort} />
      </div>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton>Vereinsdaten speichern</SendenButton>
      </div>
    </form>
  );
}
