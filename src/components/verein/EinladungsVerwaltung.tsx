"use client";

import { useActionState, useState } from "react";
import { Copy, Check, XCircle } from "lucide-react";
import { einladungErstellen, einladungWiderrufen } from "@/app/dashboard/verein/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { Auswahl, OffeneEinladung } from "@/lib/verein/getVerein";

function Kopieren({ link }: { link: string }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(link);
        setKopiert(true);
        setTimeout(() => setKopiert(false), 2000);
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-bg"
    >
      {kopiert ? <Check size={13} className="text-brand-green" /> : <Copy size={13} />}
      {kopiert ? "Kopiert" : "Link kopieren"}
    </button>
  );
}

export function EinladungsVerwaltung({
  vereinId,
  rollen,
  einladungen,
  basisUrl,
}: {
  vereinId: string;
  rollen: Auswahl[];
  einladungen: OffeneEinladung[];
  basisUrl: string;
}) {
  const [ergebnis, aktion] = useActionState(einladungErstellen, LEERES_ERGEBNIS);
  const standardRolle = rollen.find((r) => r.name.toLowerCase().startsWith("tänzer"))?.id ?? "";

  return (
    <div className="flex flex-col gap-4">
      <form action={aktion} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="verein_id" value={vereinId} />
        <label className="field">
          <span>Rolle im Verein</span>
          <select name="rolle_id" defaultValue={standardRolle} required>
            {rollen.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Gültig (Tage)</span>
          <input type="number" name="tage" min={1} max={90} defaultValue={14} />
        </label>
        <label className="field">
          <span>Nutzbar (Personen)</span>
          <input type="number" name="anzahl" min={1} max={200} defaultValue={1} />
        </label>
        <SendenButton laedtText="Wird erstellt …">Link erstellen</SendenButton>
      </form>
      <Meldung ergebnis={ergebnis} />

      {einladungen.length > 0 && (
        <ul className="flex flex-col divide-y divide-brand-line rounded-xl border border-brand-line">
          {einladungen.map((e) => {
            const link = `${basisUrl}/einladung/${e.token}`;
            return (
              <li key={e.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {e.rolle ?? "Mitglied"} · {e.uses}/{e.maxUses} genutzt
                  </div>
                  <div className="truncate text-[12px] text-brand-ink-soft">
                    {link}
                    {e.laeuftAb ? ` · gültig bis ${new Date(e.laeuftAb).toLocaleDateString("de-DE")}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Kopieren link={link} />
                  <form action={einladungWiderrufen}>
                    <input type="hidden" name="einladung_id" value={e.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-red/30 px-3 text-[12.5px] font-medium text-brand-red hover:bg-brand-red-wash"
                    >
                      <XCircle size={13} /> Zurückziehen
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
