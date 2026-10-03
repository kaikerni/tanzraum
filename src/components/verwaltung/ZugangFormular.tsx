"use client";

import { useActionState } from "react";
import { statistikInhalteSpeichern, zugangSpeichern } from "@/app/dashboard/vereinsverwaltung/actions";
import { LEERES_ERGEBNIS, Meldung, SendenButton } from "@/components/ui/SendenButton";
import { STATISTIK_INHALTE } from "@/lib/verein/statistik";

const BEREICHE = [
  { id: "kostueme", label: "Kostüme & Requisiten" },
  { id: "finanzen", label: "Finanzen" },
  { id: "statistiken", label: "Statistiken" },
];
const ROLLEN = [
  { id: "trainer", label: "Trainer" },
  { id: "betreuer", label: "Betreuer" },
  { id: "mitglied", label: "Tänzer" },
  { id: "eltern", label: "Eltern" },
  { id: "sonstige", label: "Sonstige" },
];

// Wer hat Zugriff auf welchen Bereich? Der Vereinsadmin hat immer Zugriff.
export function ZugangFormular({ vereinId, zugaenge }: { vereinId: string; zugaenge: Record<string, string[]> }) {
  const [ergebnis, aktion] = useActionState(zugangSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] text-brand-ink-soft">
              <th className="py-2 pr-3 font-semibold">Bereich</th>
              <th className="px-2 py-2 text-center font-semibold">Admin</th>
              {ROLLEN.map((r) => (
                <th key={r.id} className="px-2 py-2 text-center font-semibold">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {BEREICHE.map((b) => (
              <tr key={b.id}>
                <td className="py-2.5 pr-3 font-semibold text-brand-ink">{b.label}</td>
                <td className="px-2 text-center">
                  <input type="checkbox" checked disabled aria-label={`${b.label}: Admin`} className="h-4 w-4 accent-[#e11d2e] opacity-60" />
                </td>
                {ROLLEN.map((r) => (
                  <td key={r.id} className="px-2 text-center">
                    <input
                      type="checkbox"
                      name={`${b.id}_${r.id}`}
                      value="an"
                      defaultChecked={(zugaenge[b.id] ?? []).includes(r.id)}
                      aria-label={`${b.label}: ${r.label}`}
                      className="h-4 w-4 accent-[#e11d2e]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-brand-ink-soft">
        Einzelne Personen könnt ihr zusätzlich in der Mitgliederliste freischalten (Bereichsrechte, z. B. „Beiträge &amp; Finanzen“).
        Fahrgemeinschaften stehen immer allen Mitgliedern offen.
      </p>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton>Zugriffe speichern</SendenButton>
      </div>
    </form>
  );
}

export function StatistikInhalteFormular({ vereinId, inhalte }: { vereinId: string; inhalte: string[] }) {
  const [ergebnis, aktion] = useActionState(statistikInhalteSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STATISTIK_INHALTE.map((i) => (
          <label key={i.id} className="flex items-center gap-2.5 text-[13.5px] text-brand-ink">
            <input type="checkbox" name={`inhalt_${i.id}`} value="an" defaultChecked={inhalte.includes(i.id)} className="h-4 w-4 accent-[#e11d2e]" />
            {i.label}
          </label>
        ))}
      </div>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton variante="sekundaer">Inhalte speichern</SendenButton>
      </div>
    </form>
  );
}
