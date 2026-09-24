"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Users, Medal, ChevronDown } from "lucide-react";
import { startLoeschen } from "@/app/dashboard/turniere/actions";
import { StartFormular, ErgebnisFormular } from "./StartFormular";
import {
  datumKurz,
  RUECKMELDUNG_LABEL,
  STATUS_LABEL,
  startTitel,
  type PlanungsVerein,
  type Stammdaten,
  type Start,
  type StartTeilnehmer,
  type TurnierTag,
} from "@/lib/turniere/getTurniere";

const STATUS_BADGE = { geplant: "offen", gemeldet: "zugesagt", abgesagt: "abgesagt" } as const;
const RM_BADGE = { dabei: "zugesagt", unsicher: "vielleicht", nicht_dabei: "abgesagt" } as const;

export function StartKarte({
  start,
  teilnehmer,
  verein,
  tage,
  stammdaten,
  vorbei,
}: {
  start: Start;
  teilnehmer: StartTeilnehmer[];
  verein: PlanungsVerein | null;
  tage: TurnierTag[];
  stammdaten: Stammdaten;
  vorbei: boolean;
}) {
  const [modus, setModus] = useState<"ansicht" | "bearbeiten">("ansicht");
  const [liste, setListe] = useState(false);
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const details = [start.disziplin, start.altersklasse].filter(Boolean).join(" · ");
  const offen = start.teilnehmer - start.dabei - start.nichtDabei - start.unsicher;

  if (modus === "bearbeiten" && verein) {
    return (
      <li className="rounded-2xl border border-brand-red/30 bg-white p-3">
        <StartFormular verein={verein} turnierId={start.turnierId} tage={tage} stammdaten={stammdaten} start={start} onFertig={() => setModus("ansicht")} />
        <button type="button" onClick={() => setModus("ansicht")} className="mt-2 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          Abbrechen
        </button>
      </li>
    );
  }

  return (
    <li className={`flex flex-col gap-2 rounded-2xl border border-brand-line bg-white p-3 ${start.status === "abgesagt" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-bold text-brand-ink ${start.status === "abgesagt" ? "line-through" : ""}`}>{startTitel(start)}</p>
          <p className="text-[12.5px] text-brand-ink-soft">
            {[details || null, start.tag ? datumKurz(start.tag) : null, start.startzeit ? `${start.startzeit} Uhr` : null, start.startnummer ? `Startnr. ${start.startnummer}` : null]
              .filter(Boolean)
              .join(" · ") || "Details folgen"}
          </p>
          {start.bezeichnung && start.solistenNamen && <p className="text-[12.5px] text-brand-ink-soft">{start.solistenNamen}</p>}
          {start.notiz && <p className="mt-1 text-[12.5px] text-brand-ink">{start.notiz}</p>}
        </div>
        <span className={`status-badge ${STATUS_BADGE[start.status]}`}>{STATUS_LABEL[start.status]}</span>
      </div>

      {start.platz !== null || start.punkte !== null ? (
        <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink">
          <Medal size={15} className="text-brand-gold" />
          {start.platz !== null ? `Platz ${start.platz}` : ""}
          {start.punkte !== null ? `${start.platz !== null ? " · " : ""}${start.punkte.toLocaleString("de-DE")} Punkte` : ""}
          {start.ergebnisNotiz ? <span className="font-normal text-brand-ink-soft"> · {start.ergebnisNotiz}</span> : null}
        </p>
      ) : null}

      {start.teilnehmer > 0 && start.status !== "abgesagt" && (
        <button
          type="button"
          onClick={() => setListe(!liste)}
          disabled={teilnehmer.length === 0}
          aria-expanded={liste}
          className="flex flex-wrap items-center gap-1.5 self-start text-[12.5px] text-brand-ink-soft disabled:cursor-default"
        >
          <Users size={14} />
          <span className="status-badge zugesagt">{start.dabei} dabei</span>
          {start.unsicher > 0 && <span className="status-badge vielleicht">{start.unsicher} unsicher</span>}
          {start.nichtDabei > 0 && <span className="status-badge abgesagt">{start.nichtDabei} nicht dabei</span>}
          {offen > 0 && <span>{offen} offen</span>}
          {teilnehmer.length > 0 && <ChevronDown size={14} className={liste ? "rotate-180" : ""} />}
        </button>
      )}
      {liste && (
        <ul className="grid grid-cols-1 gap-1 rounded-xl bg-brand-bg p-2 sm:grid-cols-2">
          {teilnehmer.map((t) => (
            <li key={t.vmId} className="flex items-center justify-between gap-2 px-1.5 py-1 text-[13px]">
              <span className="truncate text-brand-ink">{t.name}</span>
              <span className={`status-badge ${t.status ? RM_BADGE[t.status] : "offen"}`}>{t.status ? RUECKMELDUNG_LABEL[t.status] : "offen"}</span>
            </li>
          ))}
        </ul>
      )}

      {start.darfBearbeiten && verein && (
        <>
          {vorbei && start.status !== "abgesagt" && (
            <div className="rounded-xl bg-brand-bg p-2.5">
              <ErgebnisFormular start={start} />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModus("bearbeiten")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-bg"
            >
              <Pencil size={13} /> Bearbeiten
            </button>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => {
                if (!confirm("Diesen Start wirklich löschen? Rückmeldungen gehen dabei verloren.")) return;
                starte(async () => {
                  const r = await startLoeschen(start.id);
                  if (r.error) setFehler(r.error);
                });
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-red/30 px-3 text-[12.5px] font-medium text-brand-red hover:bg-brand-red-wash disabled:opacity-60"
            >
              <Trash2 size={13} /> Löschen
            </button>
          </div>
          {fehler && <p className="form-error">{fehler}</p>}
        </>
      )}
    </li>
  );
}
