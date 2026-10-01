"use client";

import { useState, useTransition } from "react";
import { Search, Building2, Loader2 } from "lucide-react";
import { vereineSuchen, beitrittAnfragen, beitrittZurueckziehen, type VereinTreffer } from "@/app/dashboard/verein/actions";

export type MeineAnfrage = { id: string; vereinName: string; status: string; erstelltAm: string };

const STATUS: Record<string, string> = { offen: "wartet auf den Verein", angenommen: "angenommen", abgelehnt: "nicht angenommen", zurueckgezogen: "zurückgezogen" };

// Verein suchen → „Beitritt anfragen“ → der Vereinsadmin entscheidet (Registrierung allein macht niemanden zum Mitglied)
export function VereinSuchen({ anfragen }: { anfragen: MeineAnfrage[] }) {
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<VereinTreffer[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<VereinTreffer | null>(null);
  const [nachricht, setNachricht] = useState("");
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [laeuft, starte] = useTransition();
  const offen = anfragen.find((a) => a.status === "offen");

  return (
    <section className="rounded-[var(--radius-l)] border border-brand-line bg-white p-5 shadow-[var(--shadow)] lg:col-span-2">
      <div className="mb-3 flex items-center gap-2.5">
        <Search size={20} className="text-brand-red" />
        <h2 className="text-[16px] font-bold text-brand-ink">Verein suchen</h2>
      </div>
      {offen ? (
        <div className="flex flex-col gap-2 rounded-xl bg-brand-bg px-4 py-3">
          <p className="text-[14px] text-brand-ink">
            Deine Beitrittsanfrage an <strong>{offen.vereinName}</strong> {STATUS.offen}.
          </p>
          <button
            type="button"
            disabled={laeuft}
            onClick={() => starte(async () => {
              const r = await beitrittZurueckziehen(offen.id);
              setMeldung({ text: r.error ?? r.ok ?? "", fehler: !!r.error });
            })}
            className="self-start text-[13px] font-semibold text-brand-red hover:underline"
          >
            Anfrage zurückziehen
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-brand-ink-soft">
            Finde deinen Verein und frage den Beitritt an. Mitglied wirst du, sobald der Verein deine Anfrage annimmt.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setGewaehlt(null);
              starte(async () => setTreffer(await vereineSuchen(suche)));
            }}
            className="flex gap-2"
          >
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Vereinsname oder Ort"
              aria-label="Verein suchen"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-brand-line px-3 text-[15px] outline-none focus:border-brand-red"
            />
            <button type="submit" disabled={laeuft || suche.trim().length < 2} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-ink px-4 text-[14px] font-semibold text-white disabled:opacity-50">
              {laeuft ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Suchen
            </button>
          </form>
          {treffer && (
            <ul className="mt-3 flex flex-col gap-2">
              {treffer.length === 0 && <li className="text-[13.5px] text-brand-ink-soft">Kein Verein gefunden. Nur Vereine mit Vereinslizenz sind auffindbar.</li>}
              {treffer.map((v) => (
                <li key={v.vereinId} className="flex flex-col gap-2 rounded-xl border border-brand-line px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {v.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-contain" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold-wash text-brand-gold">
                        <Building2 size={18} />
                      </span>
                    )}
                    <div className="min-w-[10rem] flex-1">
                      <p className="text-[15px] font-bold text-brand-ink [overflow-wrap:break-word] [hyphens:auto]" lang="de">{v.name}</p>
                      {v.ort && <p className="text-[12.5px] text-brand-ink-soft">{v.ort}</p>}
                    </div>
                    {gewaehlt?.vereinId !== v.vereinId && (
                      <button type="button" onClick={() => setGewaehlt(v)} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-brand-red px-3.5 max-sm:w-full text-[13.5px] font-semibold text-white">
                        Beitritt anfragen
                      </button>
                    )}
                  </div>
                  {gewaehlt?.vereinId === v.vereinId && (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={nachricht}
                        onChange={(e) => setNachricht(e.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder="Nachricht an den Verein (optional), z. B. in welcher Gruppe du tanzt"
                        className="rounded-xl border border-brand-line px-3 py-2 text-[14px] outline-none focus:border-brand-red"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={laeuft}
                          onClick={() => starte(async () => {
                            const r = await beitrittAnfragen(v.vereinId, nachricht);
                            setMeldung({ text: r.error ?? r.ok ?? "", fehler: !!r.error });
                            if (!r.error) setTreffer(null);
                          })}
                          className="inline-flex min-h-10 items-center rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white disabled:opacity-60"
                        >
                          Anfrage senden
                        </button>
                        <button type="button" onClick={() => setGewaehlt(null)} className="min-h-10 rounded-xl px-3 text-[13.5px] text-brand-ink-soft hover:bg-brand-bg">
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {meldung && <p className={`mt-3 ${meldung.fehler ? "form-error" : "text-[13.5px] font-semibold text-brand-green"}`}>{meldung.text}</p>}
      {anfragen.filter((a) => a.status !== "offen").slice(0, 2).map((a) => (
        <p key={a.id} className="mt-2 text-[12.5px] text-brand-ink-soft">
          Frühere Anfrage an {a.vereinName}: {STATUS[a.status] ?? a.status}
        </p>
      ))}
    </section>
  );
}
