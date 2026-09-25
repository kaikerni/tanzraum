"use client";

import { useState, useTransition } from "react";
import { Handshake, MessageCircle, Clock, Check, X, Ban } from "lucide-react";
import { anfrageBeantworten, anfrageZurueckziehen, blockieren, nachrichtOeffnen, vernetzen } from "@/app/dashboard/netzwerk/actions";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { sperrgrundText } from "@/lib/chat/sperrgrund";
import { MeldenKnopf } from "./Melden";
import type { PersonProfil } from "@/lib/netzwerk/tanzraumNetzwerk";

const KNOPF = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold disabled:opacity-60";

export function PersonAktionen({ person }: { person: PersonProfil }) {
  const [status, setStatus] = useState(person.status);
  const [blockiert, setBlockiert] = useState(person.blockiertVonMir);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const tue = (aktion: () => Promise<AktionsErgebnis & { status?: string }>, danach?: (r: AktionsErgebnis & { status?: string }) => void) =>
    starte(async () => {
      const r = await aktion();
      setMeldung(r);
      if (!r.error) danach?.(r);
    });

  // Hinweis, warum keine Nachricht moeglich ist (nur wenn nicht gerade eine Vernetzung weiterhilft)
  const hinweis =
    !person.darfSchreiben && person.sperrgrund && !(person.sperrgrund === "kontakt_noetig" && person.kannVernetzen && status !== "verbunden")
      ? sperrgrundText(person.sperrgrund)
      : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {person.darfSchreiben && !blockiert && (
          <button type="button" disabled={laeuft} onClick={() => tue(() => nachrichtOeffnen(person.id))} className={`${KNOPF} bg-brand-red text-white hover:bg-brand-red-deep`}>
            <MessageCircle size={17} /> Nachricht senden
          </button>
        )}
        {!blockiert && person.kannVernetzen && (status === null || status === "abgelehnt") && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => tue(() => vernetzen(person.id), (r) => setStatus((r.status as PersonProfil["status"]) ?? "angefragt"))}
            className={`${KNOPF} ${person.darfSchreiben ? "border border-brand-line bg-white text-brand-ink hover:bg-brand-bg" : "bg-brand-red text-white hover:bg-brand-red-deep"}`}
          >
            <Handshake size={17} /> Vernetzen
          </button>
        )}
        {status === "angefragt" && (
          <>
            <span className={`${KNOPF} bg-brand-gold-wash text-brand-gold`}>
              <Clock size={16} /> Anfrage gesendet
            </span>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageZurueckziehen(person.id), () => setStatus(null))} className={`${KNOPF} border border-brand-line bg-white text-brand-ink`}>
              Zurückziehen
            </button>
          </>
        )}
        {status === "eingehend" && !blockiert && (
          <>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageBeantworten(person.id, true), () => setStatus("verbunden"))} className={`${KNOPF} bg-brand-green text-white`}>
              <Check size={17} /> Vernetzung annehmen
            </button>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageBeantworten(person.id, false), () => setStatus(null))} className={`${KNOPF} border border-brand-line bg-white text-brand-ink`}>
              <X size={17} /> Ablehnen
            </button>
          </>
        )}
        {status === "verbunden" && (
          <span className={`${KNOPF} bg-brand-green-wash text-brand-green`}>
            <Handshake size={16} /> Vernetzt
          </span>
        )}
      </div>
      {hinweis && <p className="text-[12.5px] text-brand-ink-soft">{hinweis}</p>}
      {meldung && <Meldung ergebnis={meldung} />}
      <div className="flex flex-wrap gap-2 pt-1">
        <MeldenKnopf userId={person.id} titel="Nutzer melden" />
        <button
          type="button"
          disabled={laeuft}
          onClick={() => {
            if (!blockiert && !confirm(`${person.name} blockieren? Ihr könnt euch dann nicht mehr kontaktieren.`)) return;
            tue(() => blockieren(person.id, !blockiert), () => setBlockiert(!blockiert));
          }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink-soft hover:bg-brand-bg"
        >
          <Ban size={15} /> {blockiert ? "Blockierung aufheben" : "Blockieren"}
        </button>
      </div>
    </div>
  );
}
