"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Search, MessageCircle, UserPlus, ShieldAlert, Clock, Ban } from "lucide-react";
import {
  kontaktAufnehmen,
  kontaktanfrageSenden,
  kontaktanfrageZurueckziehen,
  nutzerFreigeben,
  nutzerSuchen,
  type KontaktErgebnis,
} from "@/app/dashboard/nachrichten/actions";
import type { Kontakt, Kontaktanfrage, SuchTreffer } from "@/lib/chat/getChat";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { ChatAvatar } from "./ChatAvatar";

function Person({ name, zeile, avatarUrl, children, onClick }: { name: string; zeile?: string | null; avatarUrl?: string | null; children?: React.ReactNode; onClick?: () => void }) {
  const inhalt = (
    <>
      <ChatAvatar typ="dm" name={name} avatarUrl={avatarUrl} groesse={42} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-brand-ink">{name}</span>
        {zeile && <span className="block truncate text-[12.5px] text-brand-ink-soft">{zeile}</span>}
      </span>
      {children}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-brand-bg">
      {inhalt}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-2 py-2">{inhalt}</div>
  );
}

// Dialog vor einer Kontaktanfrage. Minderjaehrige bekommen den altersgerechten Hinweis.
function AnfrageDialog({ name, minderjaehrig, laeuft, onSenden, onAbbrechen }: { name: string; minderjaehrig: boolean; laeuft: boolean; onSenden: () => void; onAbbrechen: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-navy/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="anfrage-titel">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-2 flex items-center gap-2">
          <ShieldAlert size={20} className="text-brand-amber" />
          <h3 id="anfrage-titel" className="text-[16px] font-bold text-brand-ink">
            Kontaktanfrage an {name}
          </h3>
        </div>
        <p className="text-[13.5px] leading-relaxed text-brand-ink-soft">
          {minderjaehrig
            ? "Du möchtest Kontakt mit einer Person außerhalb deines Vereins oder deiner Gruppe aufnehmen. Bitte achte darauf, keine persönlichen Daten wie deine Adresse, Telefonnummer oder Passwörter weiterzugeben."
            : `${name} gehört nicht zu deinem Verein oder deiner Gruppe. Ihr könnt chatten, sobald die Kontaktanfrage angenommen wurde.`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onAbbrechen} className="min-h-11 rounded-xl border border-brand-line text-[14px] font-semibold text-brand-ink">
            Abbrechen
          </button>
          <button type="button" disabled={laeuft} onClick={onSenden} className="min-h-11 rounded-xl bg-brand-red text-[14px] font-semibold text-white disabled:opacity-60">
            Kontaktanfrage senden
          </button>
        </div>
      </div>
    </div>
  );
}

export function NeuerChat({ kontakte, anfragen }: { kontakte: Kontakt[]; anfragen: Kontaktanfrage[] }) {
  const [reiter, setReiter] = useState<"kontakte" | "suchen" | "anfragen">("kontakte");
  const [filter, setFilter] = useState("");
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<SuchTreffer[] | null>(null);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [dialog, setDialog] = useState<{ userId: string; name: string; minderjaehrig: boolean } | null>(null);
  const [laeuft, starte] = useTransition();

  const gefiltert = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? kontakte.filter((k) => `${k.anzeige} ${k.handle ?? ""} ${k.grund}`.toLowerCase().includes(q)) : kontakte;
  }, [kontakte, filter]);

  const ausgehend = anfragen.filter((a) => a.richtung === "ausgehend");
  const blockiert = anfragen.filter((a) => a.richtung === "blockiert");

  function oeffnen(userId: string, name: string) {
    starte(async () => {
      const e: KontaktErgebnis = await kontaktAufnehmen(userId);
      if (e.ergebnis === "anfrage_noetig") setDialog({ userId, name, minderjaehrig: Boolean(e.ichMinderjaehrig) });
      else setMeldung(e);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex min-h-[60px] items-center gap-2 border-b border-brand-line px-2 sm:px-4">
        <Link href="/dashboard/nachrichten" aria-label="Zurück" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-[17px] font-bold text-brand-ink">Neuer Privatchat</h2>
      </header>
      <div className="flex gap-1 border-b border-brand-line px-3 pt-2" role="tablist">
        {(
          [
            ["kontakte", "Kontakte"],
            ["suchen", "Suchen"],
            ["anfragen", `Anfragen & Blockiert${ausgehend.length + blockiert.length ? ` (${ausgehend.length + blockiert.length})` : ""}`],
          ] as const
        ).map(([wert, label]) => (
          <button
            key={wert}
            type="button"
            role="tab"
            aria-selected={reiter === wert}
            onClick={() => setReiter(wert)}
            className={`min-h-11 flex-1 border-b-2 px-1 text-[13px] font-semibold ${reiter === wert ? "border-brand-red text-brand-ink" : "border-transparent text-brand-ink-soft"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-4">
        {meldung?.error && <p className="form-error mx-2 mb-3">{meldung.error}</p>}
        {meldung?.ok && <p className="mx-2 mb-3 rounded-lg bg-brand-green-wash px-3 py-2 text-[13px] text-brand-green">{meldung.ok}</p>}

        {reiter === "kontakte" && (
          <>
            <label className="mx-2 mb-2 flex min-h-10 items-center gap-2 rounded-xl bg-brand-bg px-3 text-brand-ink-soft">
              <Search size={16} />
              <span className="sr-only">Kontakte filtern</span>
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name suchen" className="min-w-0 flex-1 bg-transparent text-[14px] text-brand-ink outline-none" />
            </label>
            {gefiltert.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13.5px] text-brand-ink-soft">
                {kontakte.length === 0 ? "Noch keine Kontakte. Unter „Suchen“ findest du andere TanzRaum-Nutzer." : "Niemand gefunden."}
              </p>
            ) : (
              gefiltert.map((k) => (
                <Person key={k.userId} name={k.anzeige} zeile={k.grund} avatarUrl={k.avatarUrl} onClick={() => !laeuft && oeffnen(k.userId, k.anzeige)}>
                  <MessageCircle size={18} className="text-brand-ink-faint" />
                </Person>
              ))
            )}
            <p className="mx-2 mt-4 text-[12px] text-brand-ink-faint">
              Mit allen Mitgliedern deines Vereins, deiner Familie und angenommenen Kontakten kannst du direkt chatten.
            </p>
          </>
        )}

        {reiter === "suchen" && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                starte(async () => setTreffer(await nutzerSuchen(suche)));
              }}
              className="mx-2 mb-2 flex gap-2"
            >
              <label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl bg-brand-bg px-3 text-brand-ink-soft">
                <Search size={16} />
                <span className="sr-only">Nutzer suchen</span>
                <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="@Nutzername oder Name" className="min-w-0 flex-1 bg-transparent text-[14px] text-brand-ink outline-none" />
              </label>
              <button type="submit" disabled={laeuft || suche.trim().replace(/^@/, "").length < 3} className="min-h-10 rounded-xl bg-brand-navy px-4 text-[13px] font-semibold text-white disabled:opacity-50">
                Suchen
              </button>
            </form>
            {treffer?.length === 0 && <p className="px-3 py-4 text-center text-[13px] text-brand-ink-soft">Niemand gefunden.</p>}
            {treffer?.map((t) => (
              <Person key={t.userId} name={t.anzeige} zeile={t.handle ? `@${t.handle}` : null} avatarUrl={t.avatarUrl}>
                {t.darfSchreiben ? (
                  <button type="button" disabled={laeuft} onClick={() => oeffnen(t.userId, t.anzeige)} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand-red px-3 text-[12.5px] font-semibold text-white disabled:opacity-60">
                    <MessageCircle size={14} /> Chat
                  </button>
                ) : t.status === "angefragt" ? (
                  <span className="status-badge offen">angefragt</span>
                ) : t.status === "abgelehnt" ? (
                  <span className="status-badge abgesagt">abgelehnt</span>
                ) : t.status === "eingehend" ? (
                  <Link href="/dashboard/nachrichten" className="status-badge offen">
                    Anfrage an dich
                  </Link>
                ) : (
                  <button type="button" disabled={laeuft} onClick={() => oeffnen(t.userId, t.anzeige)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-3 text-[12.5px] font-semibold text-brand-ink disabled:opacity-60">
                    <UserPlus size={14} /> Anfragen
                  </button>
                )}
              </Person>
            ))}
            <p className="mx-2 mt-3 text-[12px] text-brand-ink-faint">Minderjährige findest du nur über ihren genauen @Nutzernamen.</p>
          </>
        )}

        {reiter === "anfragen" && (
          <div className="flex flex-col gap-4">
            <section>
              <h3 className="mx-2 mb-1 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Gesendete Anfragen</h3>
              {ausgehend.length === 0 && <p className="px-3 py-2 text-[13px] text-brand-ink-soft">Keine offenen Anfragen.</p>}
              {ausgehend.map((a) => (
                <Person key={a.userId} name={a.anzeige} zeile="wartet auf Antwort" avatarUrl={a.avatarUrl}>
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => starte(async () => setMeldung(await kontaktanfrageZurueckziehen(a.userId)))}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12px] font-semibold text-brand-ink-soft"
                  >
                    <Clock size={13} /> Zurückziehen
                  </button>
                </Person>
              ))}
            </section>
            <section>
              <h3 className="mx-2 mb-1 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Blockiert</h3>
              {blockiert.length === 0 && <p className="px-3 py-2 text-[13px] text-brand-ink-soft">Du hast niemanden blockiert.</p>}
              {blockiert.map((a) => (
                <Person key={a.userId} name={a.anzeige} zeile="blockiert" avatarUrl={a.avatarUrl}>
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => confirm(`Blockierung von ${a.anzeige} aufheben?`) && starte(async () => setMeldung(await nutzerFreigeben(a.userId)))}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12px] font-semibold text-brand-ink"
                  >
                    <Ban size={13} /> Aufheben
                  </button>
                </Person>
              ))}
            </section>
          </div>
        )}
      </div>

      {dialog && (
        <AnfrageDialog
          name={dialog.name}
          minderjaehrig={dialog.minderjaehrig}
          laeuft={laeuft}
          onAbbrechen={() => setDialog(null)}
          onSenden={() =>
            starte(async () => {
              const e = await kontaktanfrageSenden(dialog.userId);
              setMeldung(e);
              setDialog(null);
              if (!e.error && treffer) setTreffer(await nutzerSuchen(suche));
            })
          }
        />
      )}
    </div>
  );
}
