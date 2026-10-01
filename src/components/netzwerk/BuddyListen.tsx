"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageCircle, UserMinus, Check, X, Ban, Clock } from "lucide-react";
import { anfrageBeantworten, anfrageZurueckziehen, blockieren, buddyEntfernen, nachrichtOeffnen } from "@/app/dashboard/netzwerk/actions";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";

export type Buddy = { userId: string; anzeige: string; handle: string | null; avatarUrl: string | null; vereine: string | null; online: boolean; darfSchreiben: boolean };
export type BuddyAnfrage = { userId: string; anzeige: string; handle: string | null; avatarUrl: string | null; richtung: "eingehend" | "ausgehend" | "blockiert" };

const KNOPF = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold disabled:opacity-60";

function Bild({ name, url, online }: { name: string; url: string | null; online?: boolean }) {
  return (
    <span className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <span className={`flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-bold text-white ${farbeFuer(name)}`}>{initialen(name)}</span>
      )}
      {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-green" aria-label="online" title="online" />}
    </span>
  );
}

function useAktion() {
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const tue = (aktion: () => Promise<AktionsErgebnis>, danach?: () => void) =>
    starte(async () => {
      const r = await aktion();
      setMeldung(r);
      if (!r.error) danach?.();
    });
  return { meldung, laeuft, tue };
}

// Meine Buddys (ab BASIC): mit Online-Status, Nachricht, Entfernen
export function BuddyListe({ start }: { start: Buddy[] }) {
  const [liste, setListe] = useState(start);
  const { meldung, laeuft, tue } = useAktion();
  const online = liste.filter((b) => b.online).length;
  if (liste.length === 0)
    return (
      <p className="rounded-[var(--radius-l)] border border-brand-line bg-white px-4 py-8 text-center text-[13.5px] text-brand-ink-soft shadow-[var(--shadow)]">
        Noch keine Buddys. Finde Leute unter{" "}
        <Link href="/dashboard/netzwerk/suche" className="font-semibold text-brand-red">
          Nutzer suchen
        </Link>{" "}
        und tippe im Profil auf „Als Buddy hinzufügen“.
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] text-brand-ink-soft">
        {liste.length} {liste.length === 1 ? "Buddy" : "Buddys"} · {online} online
      </p>
      {meldung && <Meldung ergebnis={meldung} />}
      <ul className="divide-y divide-brand-line overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)]">
        {liste.map((b) => (
          <li key={b.userId} className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
            <Link href={`/dashboard/netzwerk/person/${b.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Bild name={b.anzeige} url={b.avatarUrl} online={b.online} />
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-bold text-brand-ink">{b.anzeige}</span>
                <span className="block truncate text-[12.5px] text-brand-ink-soft">
                  {b.online ? <span className="font-semibold text-brand-green">online</span> : (b.vereine ?? (b.handle ? `@${b.handle}` : ""))}
                </span>
              </span>
            </Link>
            <div className="flex gap-1.5">
              {b.darfSchreiben && (
                <button type="button" disabled={laeuft} onClick={() => tue(() => nachrichtOeffnen(b.userId))} className={`${KNOPF} bg-brand-red text-white hover:bg-brand-red-deep`}>
                  <MessageCircle size={15} /> Nachricht
                </button>
              )}
              <button
                type="button"
                disabled={laeuft}
                onClick={() => confirm(`${b.anzeige} als Buddy entfernen? Eure Chats bleiben erhalten.`) && tue(() => buddyEntfernen(b.userId), () => setListe((l) => l.filter((x) => x.userId !== b.userId)))}
                className={`${KNOPF} border border-brand-line bg-white text-brand-ink-soft hover:text-brand-red`}
                aria-label={`${b.anzeige} als Buddy entfernen`}
              >
                <UserMinus size={15} /> <span className="hidden sm:inline">Entfernen</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Buddy-Anfragen (ab BASIC): eingehend annehmen/ablehnen/blockieren, ausgehend zurueckziehen, Blockierte freigeben
export function BuddyAnfragen({ start }: { start: BuddyAnfrage[] }) {
  const [liste, setListe] = useState(start);
  const { meldung, laeuft, tue } = useAktion();
  const weg = (id: string) => () => setListe((l) => l.filter((x) => x.userId !== id));
  const abschnitt = (richtung: BuddyAnfrage["richtung"]) => liste.filter((a) => a.richtung === richtung);
  const eingehend = abschnitt("eingehend");
  const ausgehend = abschnitt("ausgehend");
  const blockiert = abschnitt("blockiert");

  const Zeile = ({ a, children }: { a: BuddyAnfrage; children: React.ReactNode }) => (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
      <Link href={`/dashboard/netzwerk/person/${a.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Bild name={a.anzeige} url={a.avatarUrl} />
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-bold text-brand-ink">{a.anzeige}</span>
          {a.handle && <span className="block truncate text-[12.5px] text-brand-ink-faint">@{a.handle}</span>}
        </span>
      </Link>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </li>
  );
  const Liste = ({ titel, children, anzahl }: { titel: string; anzahl: number; children: React.ReactNode }) =>
    anzahl === 0 ? null : (
      <section className="flex flex-col gap-1.5">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-brand-ink-faint">{titel}</h2>
        <ul className="divide-y divide-brand-line overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)]">{children}</ul>
      </section>
    );

  return (
    <div className="flex flex-col gap-4">
      {meldung && <Meldung ergebnis={meldung} />}
      {eingehend.length === 0 && ausgehend.length === 0 && (
        <p className="rounded-[var(--radius-l)] border border-brand-line bg-white px-4 py-8 text-center text-[13.5px] text-brand-ink-soft shadow-[var(--shadow)]">Keine offenen Buddy-Anfragen.</p>
      )}
      <Liste titel="Neue Buddy-Anfragen" anzahl={eingehend.length}>
        {eingehend.map((a) => (
          <Zeile key={a.userId} a={a}>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageBeantworten(a.userId, true), weg(a.userId))} className={`${KNOPF} bg-brand-green text-white`}>
              <Check size={15} /> Annehmen
            </button>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageBeantworten(a.userId, false), weg(a.userId))} className={`${KNOPF} border border-brand-line bg-white text-brand-ink`}>
              <X size={15} /> Ablehnen
            </button>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => confirm(`${a.anzeige} blockieren? Ihr könnt euch dann nicht mehr kontaktieren.`) && tue(() => blockieren(a.userId, true), weg(a.userId))}
              className={`${KNOPF} border border-brand-red/40 bg-white text-brand-red`}
              aria-label={`${a.anzeige} blockieren`}
            >
              <Ban size={15} />
            </button>
          </Zeile>
        ))}
      </Liste>
      <Liste titel="Gesendete Anfragen" anzahl={ausgehend.length}>
        {ausgehend.map((a) => (
          <Zeile key={a.userId} a={a}>
            <span className={`${KNOPF} bg-brand-gold-wash text-brand-gold`}>
              <Clock size={15} /> Ausstehend
            </span>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageZurueckziehen(a.userId), weg(a.userId))} className={`${KNOPF} border border-brand-line bg-white text-brand-ink`}>
              Zurückziehen
            </button>
          </Zeile>
        ))}
      </Liste>
      <Liste titel="Blockiert" anzahl={blockiert.length}>
        {blockiert.map((a) => (
          <Zeile key={a.userId} a={a}>
            <button type="button" disabled={laeuft} onClick={() => tue(() => blockieren(a.userId, false), weg(a.userId))} className={`${KNOPF} border border-brand-line bg-white text-brand-ink`}>
              Blockierung aufheben
            </button>
          </Zeile>
        ))}
      </Liste>
    </div>
  );
}
