"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { StartFormular } from "./StartFormular";
import { vereinsturnierLoeschen } from "@/app/dashboard/turniere/actions";
import type { PlanungsVerein, Stammdaten, TurnierTag } from "@/lib/turniere/getTurniere";

export function NeuerStart({
  verein,
  turnierId,
  tage,
  stammdaten,
}: {
  verein: PlanungsVerein;
  turnierId: string;
  tage: TurnierTag[];
  stammdaten: Stammdaten;
}) {
  const [offen, setOffen] = useState(false);
  const [runde, setRunde] = useState(0);

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl bg-brand-red px-3.5 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
      >
        <Plus size={16} /> Start einplanen
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-bg/60 p-3">
      <StartFormular
        key={runde}
        verein={verein}
        turnierId={turnierId}
        tage={tage}
        stammdaten={stammdaten}
        onFertig={() => {
          setRunde(runde + 1);
          setOffen(false);
        }}
      />
      <button type="button" onClick={() => setOffen(false)} className="mt-2 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        Abbrechen
      </button>
    </div>
  );
}

export function VereinsturnierLoeschen({ turnierId }: { turnierId: string }) {
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={laeuft}
        onClick={() => {
          if (!confirm("Dieses Vereinsturnier mit allen geplanten Starts löschen?")) return;
          starte(async () => {
            const r = await vereinsturnierLoeschen(turnierId);
            if (r?.error) setFehler(r.error);
          });
        }}
        className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-brand-red/30 px-3 text-[12.5px] font-medium text-brand-red hover:bg-brand-red-wash disabled:opacity-60"
      >
        <Trash2 size={13} /> Turnier löschen
      </button>
      {fehler && <p className="form-error">{fehler}</p>}
    </>
  );
}
