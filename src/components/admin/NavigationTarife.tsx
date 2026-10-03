"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { navigationTarifeSpeichern } from "@/app/dashboard/admin/navigation/actions";

const TARIFE = [
  { id: "free", label: "FREE" },
  { id: "basic", label: "BASIC" },
  { id: "verein", label: "VEREIN" },
] as const;

export type NavBereich = { href: string; label: string; hinweis?: string };

// „Navigation & Bereiche“: je Bereich festlegen, fuer welche Tarife er in der Nutzer-Navigation erscheint (nur Anzeige)
export function NavigationTarife({ bereiche, start }: { bereiche: NavBereich[]; start: Record<string, string[]> }) {
  const [wert, setWert] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(bereiche.map((b) => [b.href, Array.isArray(start[b.href]) ? start[b.href] : ["free", "basic", "verein"]])),
  );
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const umschalten = (href: string, t: string, an: boolean) =>
    setWert((w) => ({ ...w, [href]: an ? [...new Set([...(w[href] ?? []), t])] : (w[href] ?? []).filter((x) => x !== t) }));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-brand-line rounded-2xl border border-brand-line">
        {bereiche.map((b) => (
          <li key={b.href} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-brand-ink">{b.label}</p>
              {b.hinweis && <p className="text-[12px] text-brand-ink-soft">{b.hinweis}</p>}
            </div>
            <div className="flex gap-1.5" role="group" aria-label={`${b.label}: sichtbar für`}>
              {TARIFE.map((t) => {
                const an = (wert[b.href] ?? []).includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex min-h-10 min-w-[78px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-bold ${
                      an ? "border-brand-green bg-brand-green-wash text-brand-green" : "border-brand-line text-brand-ink-faint"
                    }`}
                  >
                    <input type="checkbox" checked={an} onChange={(e) => umschalten(b.href, t.id, e.target.checked)} className="h-4 w-4 accent-[#1f9d55]" aria-label={`${b.label} für ${t.label}`} />
                    {t.label}
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {meldung && <Meldung ergebnis={meldung} />}
      <div>
        <button
          type="button"
          disabled={laeuft}
          onClick={() =>
            starte(async () => {
              // Nur Abweichungen vom Standard (alle Tarife) speichern
              const abweichung = Object.fromEntries(Object.entries(wert).filter(([, t]) => t.length < 3));
              setMeldung(await navigationTarifeSpeichern(abweichung));
            })
          }
          className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5 disabled:opacity-60"
        >
          <Save size={16} /> Navigation speichern
        </button>
      </div>
    </div>
  );
}
