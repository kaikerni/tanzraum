"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, FileText, Mail, XCircle } from "lucide-react";
import { ueberweisungBestaetigen, ueberweisungStornieren } from "@/app/dashboard/admin/rechnungen/actions";
import { aufforderungErneutSenden } from "@/app/dashboard/tarif/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { datum, euro } from "@/lib/tarife";

export type UeberweisungZeile = {
  id: string;
  art: "neu" | "verlaengerung";
  status: "offen" | "bezahlt" | "storniert";
  betrag_cent: number;
  referenz: string;
  verein_name: string;
  // Vereinsgruendung: der Verein entsteht erst mit der Bestaetigung des Zahlungseingangs
  gruendung?: boolean;
  empfaenger_email: string | null;
  faellig_am: string;
  erstellt_am: string;
  versendet_am: string | null;
  bezahlt_am: string | null;
  lizenz_bis: string | null;
};

const KNOPF = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-2.5 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50";

// Offene Ueberweisungen (Vereinslizenz): Zahlungseingang bestaetigen, stornieren, Aufforderung ansehen/erneut senden
export function UeberweisungenListe({ liste }: { liste: UeberweisungZeile[] }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const offen = liste.filter((u) => u.status === "offen");
  const erledigt = liste.filter((u) => u.status !== "offen").slice(0, 10);
  const heute = new Date().toISOString().slice(0, 10);

  const aktion = (f: () => Promise<AktionsErgebnis>) => starte(async () => setMeldung(await f()));

  return (
    <div className="flex flex-col gap-3">
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="form-success">{meldung.ok}</p>}
      {offen.length === 0 ? (
        <p className="text-[13.5px] text-brand-ink-soft">Keine offenen Überweisungen.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {offen.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 rounded-xl border border-brand-line p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-0.5 text-[13.5px]">
                <span className="font-bold text-brand-ink">
                  {u.verein_name}
                  {u.gruendung ? " (Neugründung)" : ""} · {euro(u.betrag_cent)} · <span className="font-mono">{u.referenz}</span>
                </span>
                <span className="text-brand-ink-soft">
                  {u.art === "verlaengerung" ? `Verlängerung (Lizenz bis ${datum(u.lizenz_bis)})` : "Neue Vereinslizenz"} · beauftragt {datum(u.erstellt_am)} ·{" "}
                  <span className={u.faellig_am < heute ? "font-semibold text-brand-red" : ""}>fällig {datum(u.faellig_am)}</span>
                  {u.versendet_am ? ` · Aufforderung gesendet ${datum(u.versendet_am)}` : " · Aufforderung noch nicht gesendet"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => {
                    if (window.confirm(`Ist ${euro(u.betrag_cent)} von ${u.verein_name} (${u.referenz}) auf deinem Konto eingegangen? ${u.gruendung ? "Der Verein wird dann angelegt, die Lizenz freigeschaltet, die bestellende Person wird Vereinsadmin und die Rechnung wird versendet." : "Die Lizenz wird dann freigeschaltet und die Rechnung versendet."}`)) {
                      aktion(() => ueberweisungBestaetigen(u.id));
                    }
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-green px-3 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} /> Zahlung eingegangen
                </button>
                <a href={`/dashboard/tarif/zahlungsaufforderung?id=${u.id}`} target="_blank" rel="noopener" className={KNOPF}>
                  <FileText size={15} /> PDF
                </a>
                <button type="button" disabled={laeuft} onClick={() => aktion(() => aufforderungErneutSenden(u.id))} className={KNOPF}>
                  <Mail size={15} /> Erneut senden
                </button>
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => {
                    if (window.confirm(`Zahlungsaufforderung ${u.referenz} stornieren? ${u.art === "neu" ? "Die Bestellung wird verworfen." : "Die Lizenz läuft dann zum Stichtag aus."}`)) {
                      aktion(() => ueberweisungStornieren(u.id));
                    }
                  }}
                  className={KNOPF}
                >
                  <XCircle size={15} /> Stornieren
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {erledigt.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-brand-ink-soft">Zuletzt erledigt ({erledigt.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {erledigt.map((u) => (
              <li key={u.id} className="text-brand-ink-soft">
                {u.verein_name} · {euro(u.betrag_cent)} · {u.referenz} · {u.status === "bezahlt" ? `bezahlt ${datum(u.bezahlt_am)}` : "storniert"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
