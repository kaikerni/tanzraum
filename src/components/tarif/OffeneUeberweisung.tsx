"use client";

import { useState, useTransition } from "react";
import { Copy, FileText, Landmark, Mail } from "lucide-react";
import { aufforderungErneutSenden, ueberweisungZurueckziehen } from "@/app/dashboard/tarif/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { datum, euro, ibanLesbar, type Bankverbindung, type OffeneUeberweisung as Offen } from "@/lib/tarife";

const KNOPF =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50";

// Offene Zahlungsaufforderung eines Vereins: Bankverbindung zum Abtippen/Kopieren, PDF, erneut senden, zurueckziehen
export function OffeneUeberweisung({ u, bank, verein, gruendung = false }: { u: Offen; bank: Bankverbindung | null; verein: string; gruendung?: boolean }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);

  const kopieren = async (was: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(was);
      setTimeout(() => setKopiert(null), 1500);
    } catch {
      /* ohne Zwischenablage einfach abtippen */
    }
  };

  const zeilen: [string, string, boolean][] = [
    ["Kontoinhaber", bank?.inhaber ?? "", false],
    ["IBAN", ibanLesbar(bank?.iban), true],
    ...(bank?.bic ? ([["BIC", bank.bic, false]] as [string, string, boolean][]) : []),
    ["Betrag", euro(u.betrag_cent), false],
    ["Verwendungszweck", `${u.referenz} TanzRaum`, true],
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-brand-gold/50 bg-brand-gold-wash p-4">
      <div className="flex items-center gap-2 text-[15px] font-extrabold text-brand-ink">
        <Landmark size={18} className="text-brand-gold" />
        {u.art === "verlaengerung"
          ? `Verlängerung ${verein}: Überweisung offen`
          : gruendung
            ? `Vereinsgründung ${verein}: Überweisung offen`
            : `Vereinslizenz ${verein}: Überweisung offen`}
      </div>
      <p className="text-[13px] text-brand-ink">
        Bitte überweise <strong>{euro(u.betrag_cent)}</strong> bis zum <strong>{datum(u.faellig_am)}</strong>.{" "}
        {u.art === "verlaengerung"
          ? "Nach Zahlungseingang verlängert sich die Lizenz nahtlos um ein Jahr."
          : gruendung
            ? "Sobald die Zahlung eingegangen ist (meist 1–3 Werktage), wird dein Verein angelegt und die Lizenz freigeschaltet – du wirst automatisch Vereinsadmin."
            : "Die Lizenz wird freigeschaltet, sobald die Zahlung eingegangen ist (meist 1–3 Werktage)."}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-white p-3 text-[13.5px]">
        {zeilen.map(([k, v, kopierbar]) => (
          <div key={k} className="contents">
            <dt className="text-brand-ink-soft">{k}</dt>
            <dd className="flex min-w-0 items-center gap-2 font-semibold text-brand-ink">
              <span className="break-all">{v}</span>
              {kopierbar && (
                <button type="button" onClick={() => kopieren(k, v.replace(/ /g, k === "IBAN" ? "" : " "))} className="shrink-0 rounded-md p-1 text-brand-ink-soft hover:bg-brand-bg" aria-label={`${k} kopieren`}>
                  <Copy size={14} />
                </button>
              )}
              {kopiert === k && <span className="text-[11.5px] font-normal text-brand-green">kopiert</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <a href={`/dashboard/tarif/zahlungsaufforderung?id=${u.id}`} target="_blank" rel="noopener" className={KNOPF}>
          <FileText size={16} /> Zahlungsaufforderung (PDF)
        </a>
        <button type="button" disabled={laeuft} onClick={() => starte(async () => setMeldung(await aufforderungErneutSenden(u.id)))} className={KNOPF}>
          <Mail size={16} /> Erneut per E-Mail
        </button>
        {u.art === "neu" && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => {
              if (window.confirm("Überweisung zurückziehen? Du kannst die Lizenz danach mit einer anderen Zahlart abschließen.")) {
                starte(async () => setMeldung(await ueberweisungZurueckziehen(u.id)));
              }
            }}
            className="inline-flex min-h-10 items-center rounded-xl px-3 text-[13px] font-semibold text-brand-ink-soft underline hover:text-brand-red"
          >
            Zurückziehen
          </button>
        )}
      </div>
      {u.empfaenger_email && <p className="text-[12px] text-brand-ink-soft">Die Zahlungsaufforderung ging an {u.empfaenger_email}.</p>}
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="form-success">{meldung.ok}</p>}
    </div>
  );
}
