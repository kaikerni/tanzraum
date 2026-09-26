"use client";

import { useActionState, useState } from "react";
import { Copy, Check, XCircle, Mail } from "lucide-react";
import { einladungErstellen, einladungPerEmail, einladungWiderrufen } from "@/app/dashboard/verein/actions";
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

function PerEmail({ einladungId }: { einladungId: string }) {
  const [offen, setOffen] = useState(false);
  const [ergebnis, aktion] = useActionState(einladungPerEmail, LEERES_ERGEBNIS);
  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-bg"
      >
        <Mail size={13} /> Per E-Mail senden
      </button>
    );
  }
  return (
    <form action={aktion} className="flex w-full flex-col gap-2 sm:w-auto">
      <input type="hidden" name="einladung_id" value={einladungId} />
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="E-Mail-Adresse"
          autoComplete="off"
          className="min-h-9 w-full min-w-0 rounded-lg border border-brand-line px-3 text-[13px] sm:w-56"
        />
        <SendenButton laedtText="Sendet …" className="min-h-9 shrink-0 px-3 text-[12.5px]">
          Senden
        </SendenButton>
      </div>
      <Meldung ergebnis={ergebnis} />
    </form>
  );
}

export function EinladungsVerwaltung({
  vereinId,
  rollen,
  gruppen,
  einladungen,
  basisUrl,
}: {
  vereinId: string;
  rollen: Auswahl[];
  gruppen: { id: string; name: string }[];
  einladungen: OffeneEinladung[];
  basisUrl: string;
}) {
  const [ergebnis, aktion] = useActionState(einladungErstellen, LEERES_ERGEBNIS);
  const standardRolle = rollen.find((r) => r.name.toLowerCase().startsWith("tänzer"))?.id ?? "";

  return (
    <div className="flex flex-col gap-4">
      <form action={aktion} className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1.4fr_1fr_1fr_auto] sm:items-end">
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
          <span>Gruppe (optional)</span>
          <select name="gruppe_id" defaultValue="">
            <option value="">Nur Verein</option>
            {gruppen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
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
              <li key={e.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {e.rolle ?? "Mitglied"}
                    {e.gruppe ? ` · Gruppe ${e.gruppe}` : ""} · {e.uses}/{e.maxUses} genutzt
                  </div>
                  <div className="truncate text-[12px] text-brand-ink-soft">
                    {link}
                    {e.laeuftAb ? ` · gültig bis ${new Date(e.laeuftAb).toLocaleDateString("de-DE")}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PerEmail einladungId={e.id} />
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
