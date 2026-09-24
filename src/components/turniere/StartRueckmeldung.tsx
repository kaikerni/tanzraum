"use client";

import { useState, useTransition } from "react";
import { Check, X, HelpCircle } from "lucide-react";
import { startRueckmelden } from "@/app/dashboard/turniere/actions";
import { RUECKMELDUNG_LABEL, type StartRueckmeldung as Rueckmeldung } from "@/lib/turniere/getTurniere";

const OPTIONEN: { wert: Rueckmeldung; icon: typeof Check; aktiv: string }[] = [
  { wert: "dabei", icon: Check, aktiv: "border-brand-green bg-brand-green text-white" },
  { wert: "unsicher", icon: HelpCircle, aktiv: "border-brand-amber bg-brand-amber text-white" },
  { wert: "nicht_dabei", icon: X, aktiv: "border-brand-red bg-brand-red text-white" },
];

const BADGE: Record<Rueckmeldung, string> = { dabei: "zugesagt", unsicher: "vielleicht", nicht_dabei: "abgesagt" };

export function StartRueckmeldung({
  startId,
  vmId,
  name,
  status,
  gesperrt,
}: {
  startId: string;
  vmId: string;
  name: string;
  status: Rueckmeldung | null;
  gesperrt: boolean;
}) {
  const [aktuell, setAktuell] = useState(status);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-bg px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[13.5px] font-semibold text-brand-ink">{name}</span>
      {gesperrt ? (
        <span className={`status-badge ${aktuell ? BADGE[aktuell] : "offen"}`}>{aktuell ? RUECKMELDUNG_LABEL[aktuell] : "keine Rückmeldung"}</span>
      ) : (
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`Teilnahme für ${name}`}>
          {OPTIONEN.map((o) => {
            const gewaehlt = aktuell === o.wert;
            return (
              <button
                key={o.wert}
                type="button"
                disabled={laeuft}
                aria-pressed={gewaehlt}
                onClick={() => {
                  const neu = gewaehlt ? null : o.wert;
                  const vorher = aktuell;
                  setAktuell(neu);
                  setFehler(null);
                  starte(async () => {
                    const r = await startRueckmelden(startId, vmId, neu);
                    if (r.error) {
                      setAktuell(vorher);
                      setFehler(r.error);
                    }
                  });
                }}
                className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2.5 text-[12.5px] font-semibold disabled:opacity-60 ${
                  gewaehlt ? o.aktiv : "border-brand-line bg-white text-brand-ink hover:bg-white/70"
                }`}
              >
                <o.icon size={14} /> {RUECKMELDUNG_LABEL[o.wert]}
              </button>
            );
          })}
        </div>
      )}
      {fehler && <p className="form-error sm:basis-full">{fehler}</p>}
    </div>
  );
}
