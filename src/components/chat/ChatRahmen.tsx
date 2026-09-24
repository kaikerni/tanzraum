"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment, useRouter } from "next/navigation";
import { Search, SquarePen, ChevronDown, UserPlus, Check, X, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { alsChatEintrag, type ChatEintrag, type Kontaktanfrage } from "@/lib/chat/getChat";
import { kontaktanfrageBeantworten } from "@/app/dashboard/nachrichten/actions";
import { ChatAvatar, zeitKurz } from "./ChatAvatar";
import { PushSchalter } from "./PushSchalter";

const PRIVAT_GRUPPEN = ["Trainer", "Betreuer", "Andere Kontakte"] as const;

function ChatZeile({ c, offen }: { c: ChatEintrag; offen: boolean }) {
  return (
    <li>
      <Link
        href={`/dashboard/nachrichten/${c.id}`}
        aria-current={offen ? "page" : undefined}
        className={`flex items-center gap-3 px-4 py-2.5 ${offen ? "bg-brand-bg" : "hover:bg-brand-bg/60"}`}
      >
        <ChatAvatar typ={c.typ} name={c.name} avatarUrl={c.avatarUrl} />
        <div className="min-w-0 flex-1 border-b border-brand-line/70 pb-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-semibold text-brand-ink">{c.name}</span>
            <span className={`shrink-0 text-[11.5px] ${c.ungelesen > 0 ? "font-semibold text-brand-green" : "text-brand-ink-faint"}`}>
              {zeitKurz(c.letzteZeit)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate text-[13px] text-brand-ink-soft">
              {c.blockiert ? (
                <span className="inline-flex items-center gap-1">
                  <Ban size={12} /> Blockiert
                </span>
              ) : c.letzteNachricht ? (
                <>
                  {c.letzterSender && <span className="font-medium text-brand-ink">{c.letzterSender}: </span>}
                  {c.letzteNachricht}
                </>
              ) : (
                (c.untertitel ?? "Noch keine Nachrichten")
              )}
            </span>
            {c.ungelesen > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-green px-1.5 text-[11px] font-bold text-white">
                {c.ungelesen >= 99 ? "99+" : c.ungelesen}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function Abschnitt({ titel, anzahl, ungelesen, children }: { titel: string; anzahl: number; ungelesen: number; children: React.ReactNode }) {
  const [zu, setZu] = useState(false);
  if (anzahl === 0) return null;
  return (
    <section>
      <button
        type="button"
        onClick={() => setZu(!zu)}
        aria-expanded={!zu}
        className="sticky top-0 z-10 flex min-h-9 w-full items-center gap-1.5 bg-white/95 px-4 text-left text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint backdrop-blur"
      >
        <ChevronDown size={14} className={`transition-transform ${zu ? "-rotate-90" : ""}`} />
        <span className="flex-1">{titel}</span>
        {zu && ungelesen > 0 && <span className="h-2 w-2 rounded-full bg-brand-green" aria-label="ungelesen" />}
      </button>
      {!zu && children}
    </section>
  );
}

function AnfrageKarte({ a }: { a: Kontaktanfrage }) {
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const aktion = (was: "annehmen" | "ablehnen" | "blockieren") => starte(async () => setFehler((await kontaktanfrageBeantworten(a.userId, was)).error));
  return (
    <li className="mx-3 mb-2 rounded-xl border border-brand-amber/40 bg-brand-amber-wash/60 p-3">
      <div className="flex items-center gap-3">
        <ChatAvatar typ="dm" name={a.anzeige} avatarUrl={a.avatarUrl} groesse={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-brand-amber">Neue Kontaktanfrage</div>
          <div className="truncate text-[14.5px] font-semibold text-brand-ink">{a.anzeige}</div>
        </div>
      </div>
      <p className="mt-1.5 text-[12.5px] text-brand-ink-soft">Diese Person gehört nicht zu deinem Verein oder deiner Gruppe.</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button type="button" disabled={laeuft} onClick={() => aktion("annehmen")} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-brand-green text-[12.5px] font-semibold text-white disabled:opacity-60">
          <Check size={14} /> Annehmen
        </button>
        <button type="button" disabled={laeuft} onClick={() => aktion("ablehnen")} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-brand-line bg-white text-[12.5px] font-semibold text-brand-ink disabled:opacity-60">
          <X size={14} /> Ablehnen
        </button>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => confirm(`${a.anzeige} blockieren? Die Person kann dir dann nicht mehr schreiben und keine Anfragen mehr senden.`) && aktion("blockieren")}
          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-brand-red/40 bg-white text-[12.5px] font-semibold text-brand-red disabled:opacity-60"
        >
          <Ban size={14} /> Blockieren
        </button>
      </div>
      {fehler && <p className="form-error mt-2">{fehler}</p>}
    </li>
  );
}

export function ChatRahmen({ start, anfragen, children }: { start: ChatEintrag[]; anfragen: Kontaktanfrage[]; children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const [chats, setChats] = useState(start);
  const [suche, setSuche] = useState("");
  const offen = segment && segment !== "neu" ? segment : null;
  const imChat = segment !== null;
  const zeitgeber = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eingehend = anfragen.filter((a) => a.richtung === "eingehend");

  const neuLaden = useCallback(() => {
    if (zeitgeber.current) clearTimeout(zeitgeber.current);
    zeitgeber.current = setTimeout(async () => {
      const { data } = await createClient().rpc("chat_liste");
      // deno-lint-ignore no-explicit-any
      if (data) setChats((data as any[]).map(alsChatEintrag));
      router.refresh();
    }, 400);
  }, [router]);

  useEffect(() => setChats(start), [start]);

  // Neue Nachrichten in allen sichtbaren Chats (RLS filtert serverseitig) aktualisieren Liste und Zaehler.
  useEffect(() => {
    const supabase = createClient();
    const kanal = supabase
      .channel("chatliste")
      .on("postgres_changes", { event: "*", schema: "public", table: "nachrichten" }, neuLaden)
      .subscribe();
    return () => {
      supabase.removeChannel(kanal);
    };
  }, [neuLaden]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return q ? chats.filter((c) => `${c.name} ${c.untertitel ?? ""}`.toLowerCase().includes(q)) : chats;
  }, [chats, suche]);

  const vereine = gefiltert.filter((c) => c.bereich === "verein");
  const gruppen = gefiltert.filter((c) => c.bereich === "gruppe");
  const privat = gefiltert.filter((c) => c.bereich === "privat");
  const summe = (l: ChatEintrag[]) => l.reduce((a, c) => a + c.ungelesen, 0);

  return (
    <div className="-mx-3 -mb-28 -mt-4 flex h-[calc(100dvh-125px-env(safe-area-inset-bottom))] overflow-hidden border-brand-line bg-white sm:-mx-5 md:-mb-8 md:-mt-5 md:h-[calc(100dvh-76px)] xl:-mx-6">
      <aside className={`${imChat ? "hidden lg:flex" : "flex"} w-full shrink-0 flex-col border-r border-brand-line bg-white lg:w-[360px]`} aria-label="Chats">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h1 className="text-[22px] font-extrabold tracking-tight text-brand-ink">TanzRaum-Messenger</h1>
          <Link
            href="/dashboard/nachrichten/neu"
            aria-label="Neuer Privatchat"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-red text-white hover:bg-brand-red-deep"
          >
            <SquarePen size={18} />
          </Link>
        </div>
        <div className="px-4 pb-3">
          <label className="flex min-h-10 items-center gap-2 rounded-xl bg-brand-bg px-3 text-brand-ink-soft focus-within:ring-1 focus-within:ring-brand-red">
            <Search size={16} />
            <span className="sr-only">Chats durchsuchen</span>
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Suchen"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-brand-ink outline-none placeholder:text-brand-ink-faint"
            />
          </label>
        </div>
        <PushSchalter />
        <div className="flex-1 overflow-y-auto pb-4">
          {eingehend.length > 0 && (
            <section className="mb-1">
              <div className="flex min-h-9 items-center gap-1.5 px-4 text-[12px] font-bold uppercase tracking-wide text-brand-amber">
                <UserPlus size={14} /> Kontaktanfragen
              </div>
              <ul>
                {eingehend.map((a) => (
                  <AnfrageKarte key={a.userId} a={a} />
                ))}
              </ul>
            </section>
          )}

          {gefiltert.length === 0 && (
            <p className="px-5 py-8 text-center text-[13.5px] text-brand-ink-soft">
              {chats.length === 0 ? (
                <>
                  Noch keine Chats. Vereins- und Gruppenchats erscheinen automatisch, sobald du einem Verein mit Vereinslizenz angehörst.
                  <br />
                  <Link href="/dashboard/nachrichten/neu" className="font-semibold text-brand-red">
                    Privatchat starten
                  </Link>
                </>
              ) : (
                "Kein Chat gefunden."
              )}
            </p>
          )}

          <Abschnitt titel="Vereinschat" anzahl={vereine.length} ungelesen={summe(vereine)}>
            <ul>
              {vereine.map((c) => (
                <ChatZeile key={c.id} c={c} offen={offen === c.id} />
              ))}
            </ul>
          </Abschnitt>
          <Abschnitt titel="Gruppen" anzahl={gruppen.length} ungelesen={summe(gruppen)}>
            <ul>
              {gruppen.map((c) => (
                <ChatZeile key={c.id} c={c} offen={offen === c.id} />
              ))}
            </ul>
          </Abschnitt>
          <Abschnitt titel="Privat" anzahl={privat.length} ungelesen={summe(privat)}>
            {PRIVAT_GRUPPEN.map((rolle) => {
              const liste = privat.filter((c) => (c.partnerRolle ?? "Andere Kontakte") === rolle);
              if (liste.length === 0) return null;
              return (
                <div key={rolle}>
                  <div className="px-4 pb-0.5 pt-1.5 text-[11.5px] font-semibold text-brand-ink-soft">{rolle}</div>
                  <ul>
                    {liste.map((c) => (
                      <ChatZeile key={c.id} c={c} offen={offen === c.id} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </Abschnitt>
        </div>
      </aside>
      <section className={`${imChat ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col`}>{children}</section>
    </div>
  );
}
