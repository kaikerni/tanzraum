"use client";

import { useState, useTransition } from "react";
import { Check, X, HelpCircle, Trash2 } from "lucide-react";
import { rueckmelden, terminLoeschen } from "@/app/dashboard/kalender/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { Rueckmeldung, RueckmeldePerson } from "@/lib/kalender/getKalender";

const OPTIONEN: { wert: Rueckmeldung; label: string; icon: typeof Check; aktiv: string }[] = [
  { wert: "zugesagt", label: "Zusage", icon: Check, aktiv: "border-brand-green bg-brand-green text-white" },
  { wert: "vielleicht", label: "Vielleicht", icon: HelpCircle, aktiv: "border-brand-amber bg-brand-amber text-white" },
  { wert: "abgesagt", label: "Absage", icon: X, aktiv: "border-brand-red bg-brand-red text-white" },
];

function PersonRueckmeldung({ terminId, person, vorbei }: { terminId: string; person: RueckmeldePerson; vorbei: boolean }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-bg px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[13.5px] font-semibold text-brand-ink">{person.ich ? "Du" : person.name}</span>
      {vorbei ? (
        <span className={`status-badge ${person.status ?? "offen"}`}>{person.status ?? "keine Rückmeldung"}</span>
      ) : (
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`Rückmeldung für ${person.ich ? "dich" : person.name}`}>
          {OPTIONEN.map((o) => {
            const gewaehlt = person.status === o.wert;
            return (
              <button
                key={o.wert}
                type="button"
                disabled={laeuft}
                aria-pressed={gewaehlt}
                onClick={() => starte(async () => setMeldung(await rueckmelden(terminId, person.vmId, gewaehlt ? null : o.wert)))}
                className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2.5 text-[12.5px] font-semibold disabled:opacity-60 ${
                  gewaehlt ? o.aktiv : "border-brand-line bg-white text-brand-ink hover:bg-white/70"
                }`}
              >
                <o.icon size={14} /> {o.label}
              </button>
            );
          })}
        </div>
      )}
      {meldung?.error && <p className="form-error sm:basis-full">{meldung.error}</p>}
    </div>
  );
}

export function RueckmeldeListe({ terminId, personen, vorbei }: { terminId: string; personen: RueckmeldePerson[]; vorbei: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {personen.map((p) => (
        <PersonRueckmeldung key={p.vmId} terminId={terminId} person={p} vorbei={vorbei} />
      ))}
      {!vorbei && <p className="text-[12px] text-brand-ink-faint">Nochmal auf die gewählte Antwort tippen nimmt die Rückmeldung zurück.</p>}
    </div>
  );
}

export function TerminLoeschenKnopf({ terminId }: { terminId: string }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={laeuft}
        onClick={() => {
          if (confirm("Termin wirklich löschen? Alle Zu- und Absagen gehen dabei verloren.")) {
            starte(async () => setMeldung(await terminLoeschen(terminId)));
          }
        }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-red/40 bg-white px-4 text-[13.5px] font-semibold text-brand-red hover:bg-brand-red-wash disabled:opacity-60"
      >
        <Trash2 size={15} /> {laeuft ? "Wird gelöscht …" : "Löschen"}
      </button>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
    </>
  );
}
