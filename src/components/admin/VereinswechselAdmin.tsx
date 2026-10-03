"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import { adminVereinswechselDurchfuehren, type AdminVereinswechsel } from "@/app/dashboard/admin/vereine/actions";

const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });

// Blockierte Vereinswechsel: Person hat zugestimmt, neuer Verein hat angefragt, bisheriger Verein gibt nicht frei.
// Nur der TanzRaum-Admin; die Datenbank prueft Zustimmung, Anfrage und Rechte erneut und protokolliert.
export function VereinswechselAdmin({ wechsel }: { wechsel: AdminVereinswechsel[] }) {
  const [offen, setOffen] = useState<string | null>(null);
  const [grund, setGrund] = useState("");
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [laeuft, starte] = useTransition();
  const router = useRouter();

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-brand-ink">
          <ArrowRightLeft size={19} className="text-brand-gold" /> Vereinswechsel administrativ durchführen
        </h2>
        <p className="text-[12.5px] text-brand-ink-soft">
          Nur wenn die Person dem Wechsel ausdrücklich zugestimmt hat, der neue Verein die Aufnahme angefragt hat und der bisherige Verein nicht freigibt.
        </p>
      </div>
      {meldung && <p className={meldung.fehler ? "form-error" : "form-success"}>{meldung.text}</p>}
      {wechsel.length === 0 ? (
        <p className="text-[13px] text-brand-ink-soft">Keine blockierten Vereinswechsel.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {wechsel.map((w) => (
            <li key={w.id} className="flex flex-col gap-2 rounded-xl border border-brand-line px-3 py-2.5 text-[13.5px]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong className="text-brand-ink">{w.person}</strong>
                <span className="text-brand-ink-soft">
                  {w.bisherigerVerein} → {w.neuerVerein}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${w.stand === "abgelehnt" ? "bg-brand-red-wash text-brand-red" : "bg-brand-gold-wash text-brand-ink"}`}>
                  {w.stand === "abgelehnt" ? "bisheriger Verein hat abgelehnt" : "bisheriger Verein hat nicht entschieden"}
                </span>
              </div>
              <div className="text-[12px] text-brand-ink-soft">
                Zustimmung der Person am {datum(w.zugestimmtAm)}
                {w.angefragtVon ? ` · Aufnahme angefragt von ${w.angefragtVon}` : ""}
              </div>
              {offen === w.id ? (
                <div className="flex flex-col gap-2 rounded-xl border border-brand-amber/40 bg-brand-gold-wash/50 p-3">
                  <p className="flex gap-2 text-[13px] text-brand-ink">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand-amber" />
                    <span>
                      Der Nutzer hat dem Vereinswechsel zugestimmt. {w.bisherigerVerein} hat die bisherige Vereinszuordnung nicht freigegeben. Mit dieser Aktion
                      wird die Vereinszuordnung von {w.bisherigerVerein} beendet und der Nutzer {w.neuerVerein} zugeordnet. Das persönliche TanzRaum-Konto bleibt
                      erhalten. Vereinsdaten von {w.bisherigerVerein} werden nicht an {w.neuerVerein} übertragen.
                    </span>
                  </p>
                  <label className="field">
                    <span>Anlass / Grund (wird protokolliert)</span>
                    <textarea value={grund} onChange={(e) => setGrund(e.target.value)} maxLength={1000} rows={2} placeholder="z. B. Wechselwunsch per E-Mail vom …, Verein gibt nicht frei" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={laeuft || grund.trim().length < 5}
                      onClick={() =>
                        starte(async () => {
                          const r = await adminVereinswechselDurchfuehren(w.id, grund);
                          setMeldung({ text: r.error ?? r.ok ?? "", fehler: !!r.error });
                          if (!r.error) {
                            setOffen(null);
                            setGrund("");
                            router.refresh();
                          }
                        })
                      }
                      className="min-h-10 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-50"
                    >
                      Vereinswechsel durchführen
                    </button>
                    <button type="button" onClick={() => setOffen(null)} className="min-h-10 rounded-xl px-3 text-[13.5px] text-brand-ink-soft hover:bg-brand-bg">
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOffen(w.id);
                    setGrund("");
                    setMeldung(null);
                  }}
                  className="w-fit rounded-lg border border-brand-line px-3 py-1.5 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
                >
                  Vereinswechsel administrativ durchführen …
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
