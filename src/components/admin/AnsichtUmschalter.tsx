"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { ansichtWaehlen } from "@/app/dashboard/admin/actions";
import { ANSICHTEN, ANSICHT_LABEL, type Ansicht } from "@/lib/admin/ansicht";

function useWechsel() {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const wechsle = (ansicht: Ansicht | null, ziel = "/dashboard") =>
    starte(async () => {
      const r = await ansichtWaehlen(ansicht);
      if (r.error) return setFehler(r.error);
      setFehler(null);
      router.push(ziel);
      router.refresh();
    });
  return { laeuft, fehler, wechsle };
}

// Auswahl FREE / BASIC / VEREIN je Rolle – nur fuer die TanzRaum-Administration
export function AnsichtAuswahl({ aktiv, className = "" }: { aktiv: Ansicht | null; className?: string }) {
  const { laeuft, fehler, wechsle } = useWechsel();
  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <select
        aria-label="Ansicht als"
        value={aktiv ?? ""}
        disabled={laeuft}
        onChange={(e) => wechsle(e.target.value ? (e.target.value as Ansicht) : null)}
        className="min-h-10 w-full min-w-0 rounded-xl border border-brand-line bg-white px-3 text-[13.5px] font-semibold text-brand-ink"
      >
        <option value="">TanzRaum-Admin (eigene Ansicht)</option>
        <optgroup label="Tarife">
          {ANSICHTEN.filter((a) => !a.startsWith("verein")).map((a) => (
            <option key={a} value={a}>
              {ANSICHT_LABEL[a]}
            </option>
          ))}
        </optgroup>
        <optgroup label="VEREIN – Rollen">
          {ANSICHTEN.filter((a) => a.startsWith("verein")).map((a) => (
            <option key={a} value={a}>
              {ANSICHT_LABEL[a]}
            </option>
          ))}
        </optgroup>
      </select>
      {fehler && <span className="text-[12px] text-brand-red">{fehler}</span>}
    </span>
  );
}

export function AnsichtKnopf({ ansicht, children, className }: { ansicht: Ansicht; children: React.ReactNode; className?: string }) {
  const { laeuft, wechsle } = useWechsel();
  return (
    <button type="button" disabled={laeuft} onClick={() => wechsle(ansicht)} className={className}>
      {children}
    </button>
  );
}

// Hinweisleiste waehrend der Vorschau (oben im Inhaltsbereich)
export function AnsichtLeiste({ aktiv }: { aktiv: Ansicht }) {
  const { laeuft, wechsle } = useWechsel();
  return (
    <div className="sticky top-0 z-30 -mx-3 -mt-4 mb-4 border-b border-brand-gold-light bg-brand-gold-wash/95 px-3 py-2.5 backdrop-blur sm:-mx-5 sm:px-5 md:-mt-5 xl:-mx-6 xl:px-6">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-2 text-[13.5px] font-bold text-brand-ink">
          <Eye size={17} className="text-brand-gold" /> Ansicht als {ANSICHT_LABEL[aktiv]}
        </span>
        <span className="hidden min-w-0 flex-1 text-[12.5px] text-brand-ink-soft lg:block">
          Menü und Dashboard wie in diesem Tarif bzw. dieser Rolle (Beispieldaten). In den Bereichen siehst du den Aufbau – ohne echte Vereins- oder Mitgliederdaten.
        </span>
        <span className="flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto">
          <AnsichtAuswahl aktiv={aktiv} className="min-w-0 flex-1 sm:flex-none" />
          <button
            type="button"
            disabled={laeuft}
            onClick={() => wechsle(null)}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-ink px-3 text-[13px] font-semibold text-white hover:bg-brand-navy disabled:opacity-60"
          >
            <X size={15} /> Beenden
          </button>
        </span>
      </div>
    </div>
  );
}
