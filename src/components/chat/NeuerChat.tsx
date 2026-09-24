"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Search, UserPlus, Check, X, Users, MessageCircle, Clock } from "lucide-react";
import { dmStarten, gruppenchatAnlegen, nutzerSuchen, verbindungAnfragen, verbindungBeantworten, verbindungEntfernen } from "@/app/dashboard/nachrichten/actions";
import type { GruppenOption, Kontakt, SuchTreffer, Verbindung } from "@/lib/chat/getChat";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { ChatAvatar } from "./ChatAvatar";

const TYP_TEXT = { verein: "Vereinschat", eltern: "Elternchat", trainingsgruppe: "Gruppenchat" } as const;

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

export function NeuerChat({ kontakte, gruppen, verbindungen }: { kontakte: Kontakt[]; gruppen: GruppenOption[]; verbindungen: Verbindung[] }) {
  const [reiter, setReiter] = useState<"kontakte" | "gruppen" | "verbinden">("kontakte");
  const [filter, setFilter] = useState("");
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<SuchTreffer[] | null>(null);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const gefiltert = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? kontakte.filter((k) => `${k.anzeige} ${k.handle ?? ""} ${k.grund}`.toLowerCase().includes(q)) : kontakte;
  }, [kontakte, filter]);

  const eingehend = verbindungen.filter((v) => v.status === "eingehend");
  const aktion = (f: () => Promise<AktionsErgebnis>) => starte(async () => setMeldung(await f()));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex min-h-[60px] items-center gap-2 border-b border-brand-line px-2 sm:px-4">
        <Link href="/dashboard/nachrichten" aria-label="Zurück" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-[17px] font-bold text-brand-ink">Neuer Chat</h2>
      </header>
      <div className="flex gap-1 border-b border-brand-line px-3 pt-2" role="tablist">
        {(
          [
            ["kontakte", "Kontakte"],
            ["gruppen", "Gruppenchats"],
            ["verbinden", `Verbinden${eingehend.length ? ` (${eingehend.length})` : ""}`],
          ] as const
        ).map(([wert, label]) => (
          <button
            key={wert}
            type="button"
            role="tab"
            aria-selected={reiter === wert}
            onClick={() => setReiter(wert)}
            className={`min-h-11 flex-1 border-b-2 px-2 text-[13.5px] font-semibold ${reiter === wert ? "border-brand-red text-brand-ink" : "border-transparent text-brand-ink-soft"}`}
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
                {kontakte.length === 0 ? "Noch keine Kontakte. Unter „Verbinden“ findest du andere TanzRaum-Nutzer." : "Niemand gefunden."}
              </p>
            ) : (
              gefiltert.map((k) => (
                <Person key={k.userId} name={k.anzeige} zeile={k.grund} avatarUrl={k.avatarUrl} onClick={() => !laeuft && aktion(() => dmStarten(k.userId))}>
                  <MessageCircle size={18} className="text-brand-ink-faint" />
                </Person>
              ))
            )}
            <p className="mx-2 mt-4 text-[12px] text-brand-ink-faint">
              Direkt anschreiben kannst du deine Verbindungen und Vorstand, Trainer und Betreuer deiner Vereine. Vorstand, Trainer und Betreuer erreichen alle
              Mitglieder ihres Vereins.
            </p>
          </>
        )}

        {reiter === "gruppen" &&
          (gruppen.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13.5px] text-brand-ink-soft">
              Gruppenchats legen Vorstand, Trainer und Betreuer an (mit Vereinslizenz). Bestehende Gruppenchats deines Vereins findest du automatisch in deiner
              Chatliste.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {gruppen.map((g) => (
                <li key={`${g.typ}-${g.vereinId}-${g.gruppeId ?? ""}`} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <ChatAvatar typ={g.typ} name={g.name} groesse={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-brand-ink">{g.name}</span>
                    <span className="block truncate text-[12.5px] text-brand-ink-soft">
                      {TYP_TEXT[g.typ]} · {g.vereinName}
                    </span>
                  </span>
                  {g.vorhanden ? (
                    <Link href={`/dashboard/nachrichten/${g.vorhanden}`} className="inline-flex min-h-9 items-center rounded-lg border border-brand-line px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg">
                      Öffnen
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={laeuft}
                      onClick={() => aktion(() => gruppenchatAnlegen(g.typ, g.vereinId, g.gruppeId))}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand-red px-3 text-[12.5px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-60"
                    >
                      <Users size={14} /> Anlegen
                    </button>
                  )}
                </li>
              ))}
              <li className="mx-2 mt-3 text-[12px] text-brand-ink-faint">
                Mitglieder sehen die Chats automatisch: Vereinschat = alle aktiven Mitglieder, Elternchat = Eltern und Leitung, Gruppenchat = Gruppe inkl. Eltern
                der Kinder.
              </li>
            </ul>
          ))}

        {reiter === "verbinden" && (
          <div className="flex flex-col gap-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                starte(async () => setTreffer(await nutzerSuchen(suche)));
              }}
              className="mx-2 flex gap-2"
            >
              <label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl bg-brand-bg px-3 text-brand-ink-soft">
                <Search size={16} />
                <span className="sr-only">Nutzer suchen</span>
                <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="@Nutzername oder Name (mind. 3 Zeichen)" className="min-w-0 flex-1 bg-transparent text-[14px] text-brand-ink outline-none" />
              </label>
              <button type="submit" disabled={laeuft || suche.trim().replace(/^@/, "").length < 3} className="min-h-10 rounded-xl bg-brand-navy px-4 text-[13px] font-semibold text-white disabled:opacity-50">
                Suchen
              </button>
            </form>
            {treffer && (
              <section>
                <h3 className="mx-2 mb-1 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Suchergebnis</h3>
                {treffer.length === 0 && <p className="px-3 py-2 text-[13px] text-brand-ink-soft">Niemand gefunden.</p>}
                {treffer.map((t) => (
                  <Person key={t.userId} name={t.anzeige} zeile={t.handle ? `@${t.handle}` : null} avatarUrl={t.avatarUrl}>
                    {t.darfSchreiben && (
                      <button type="button" disabled={laeuft} onClick={() => aktion(() => dmStarten(t.userId))} aria-label="Chat starten" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-bg">
                        <MessageCircle size={17} />
                      </button>
                    )}
                    {t.status === "verbunden" ? (
                      <span className="status-badge zugesagt">verbunden</span>
                    ) : t.status === "angefragt" ? (
                      <span className="status-badge offen">angefragt</span>
                    ) : (
                      <button
                        type="button"
                        disabled={laeuft}
                        onClick={() =>
                          starte(async () => {
                            const e = await verbindungAnfragen(t.userId);
                            setMeldung(e);
                            if (!e.error) setTreffer(await nutzerSuchen(suche));
                          })
                        }
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-brand-red px-3 text-[12.5px] font-semibold text-white disabled:opacity-60"
                      >
                        <UserPlus size={14} /> {t.status === "eingehend" ? "Annehmen" : "Verbinden"}
                      </button>
                    )}
                  </Person>
                ))}
              </section>
            )}
            <section>
              <h3 className="mx-2 mb-1 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Meine Verbindungen</h3>
              {verbindungen.length === 0 && <p className="px-3 py-2 text-[13px] text-brand-ink-soft">Noch keine Verbindungen.</p>}
              {verbindungen.map((v) => (
                <Person
                  key={v.userId}
                  name={v.anzeige}
                  zeile={v.status === "eingehend" ? "möchte sich mit dir verbinden" : v.status === "angefragt" ? "Anfrage gesendet" : v.handle ? `@${v.handle}` : null}
                  avatarUrl={v.avatarUrl}
                >
                  {v.status === "eingehend" ? (
                    <>
                      <button type="button" disabled={laeuft} onClick={() => aktion(() => verbindungBeantworten(v.userId, true))} aria-label="Annehmen" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-green text-white">
                        <Check size={17} />
                      </button>
                      <button type="button" disabled={laeuft} onClick={() => aktion(() => verbindungBeantworten(v.userId, false))} aria-label="Ablehnen" className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-line">
                        <X size={17} />
                      </button>
                    </>
                  ) : v.status === "angefragt" ? (
                    <button type="button" disabled={laeuft} onClick={() => aktion(() => verbindungEntfernen(v.userId))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-2.5 text-[12px] font-semibold text-brand-ink-soft">
                      <Clock size={13} /> Zurückziehen
                    </button>
                  ) : (
                    <>
                      <button type="button" disabled={laeuft} onClick={() => aktion(() => dmStarten(v.userId))} aria-label="Chat starten" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-bg">
                        <MessageCircle size={17} />
                      </button>
                      <button
                        type="button"
                        disabled={laeuft}
                        onClick={() => confirm(`Verbindung mit ${v.anzeige} entfernen?`) && aktion(() => verbindungEntfernen(v.userId))}
                        aria-label="Verbindung entfernen"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-faint hover:bg-brand-bg"
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                </Person>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
