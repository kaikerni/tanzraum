"use client";

import { useState, useTransition } from "react";
import { UserPlus, Clock, Check, X, Ban, MessageCircle, UserMinus } from "lucide-react";
import {
  anfrageBeantworten,
  anfrageSenden,
  anfrageZurueckziehen,
  chatOeffnen,
  verbindungTrennen,
  type NetzwerkErgebnis,
} from "@/app/dashboard/trainer-netzwerk/actions";
import type { NetzwerkStatus } from "@/lib/netzwerk/getNetzwerk";

const KNOPF = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold disabled:opacity-60";

export function NetzwerkAktion({
  userId,
  name,
  status: start,
  mitTrennen = false,
}: {
  userId: string;
  name: string;
  status: NetzwerkStatus;
  mitTrennen?: boolean;
}) {
  const [status, setStatus] = useState(start);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const tue = (aktion: () => Promise<NetzwerkErgebnis>) =>
    starte(async () => {
      setFehler(null);
      const r = await aktion();
      if (r.error) setFehler(r.error);
      else if (r.status) setStatus(r.status);
    });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {(status === "keine" || status === "abgelehnt") && (
          <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageSenden(userId))} className={`${KNOPF} bg-brand-red text-white hover:bg-brand-red-deep`}>
            <UserPlus size={15} /> Verbindung anfragen
          </button>
        )}
        {status === "ausstehend" && (
          <>
            <span className={`${KNOPF} bg-brand-gold-wash text-brand-gold`}>
              <Clock size={15} /> Ausstehend
            </span>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageZurueckziehen(userId))} className={`${KNOPF} border border-brand-line bg-white text-brand-ink hover:bg-brand-bg`}>
              Zurückziehen
            </button>
          </>
        )}
        {status === "eingehend" && (
          <>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageBeantworten(userId, "annehmen"))} className={`${KNOPF} bg-brand-green text-white`}>
              <Check size={15} /> Annehmen
            </button>
            <button type="button" disabled={laeuft} onClick={() => tue(() => anfrageBeantworten(userId, "ablehnen"))} className={`${KNOPF} border border-brand-line bg-white text-brand-ink`}>
              <X size={15} /> Ablehnen
            </button>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => confirm(`${name} blockieren? Ihr könnt euch dann nicht mehr schreiben oder anfragen.`) && tue(() => anfrageBeantworten(userId, "blockieren"))}
              className={`${KNOPF} border border-brand-red/40 bg-white text-brand-red`}
            >
              <Ban size={15} /> Blockieren
            </button>
          </>
        )}
        {status === "verbunden" && (
          <>
            <button type="button" disabled={laeuft} onClick={() => tue(() => chatOeffnen(userId))} className={`${KNOPF} bg-brand-red text-white hover:bg-brand-red-deep`}>
              <MessageCircle size={15} /> Nachricht schreiben
            </button>
            {mitTrennen && (
              <button
                type="button"
                disabled={laeuft}
                onClick={() => confirm(`Verbindung mit ${name} entfernen?`) && tue(() => verbindungTrennen(userId))}
                className={`${KNOPF} border border-brand-line bg-white text-brand-ink-soft hover:text-brand-red`}
              >
                <UserMinus size={15} /> Verbindung entfernen
              </button>
            )}
          </>
        )}
      </div>
      {fehler && <p className="form-error">{fehler}</p>}
    </div>
  );
}

export function StatusChip({ status }: { status: NetzwerkStatus }) {
  if (status === "verbunden") return <span className="status-badge zugesagt">Verbunden</span>;
  if (status === "ausstehend") return <span className="status-badge offen">Ausstehend</span>;
  if (status === "eingehend") return <span className="status-badge vielleicht">Fragt dich an</span>;
  return <span className="text-[12.5px] font-semibold text-brand-red">Profil ansehen</span>;
}
