"use client";

import { useState } from "react";
import { Pencil, Users, UserCog, HeartHandshake, Layers, Tag, Trash2 } from "lucide-react";
import { gruppeLoeschen } from "@/app/dashboard/verein/actions";
import type { Auswahl, DisziplinInfo, GruppeUebersicht } from "@/lib/verein/getVerein";
import { GruppenAssistent, type AssistentSchritt } from "./GruppenAssistent";

const KNOPF = "inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg";

// „Gruppe öffnen“ → gezielt ändern: oeffnet den Assistenten direkt beim passenden Schritt
export function GruppeAktionen({
  vereinId,
  gruppe,
  altersklassen,
  disziplinen,
  freieAltersklassen,
}: {
  vereinId: string;
  gruppe: GruppeUebersicht;
  altersklassen: Auswahl[];
  disziplinen: DisziplinInfo[];
  freieAltersklassen: string[];
}) {
  const [start, setStart] = useState<AssistentSchritt | null>(null);
  const tanzWort = gruppe.besetzung === "paar" || gruppe.besetzung === "solo" ? "Teilnehmer" : "Mitglieder";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setStart("taenzer")} className={KNOPF}>
          <Users size={16} /> {tanzWort} ändern
        </button>
        <button type="button" onClick={() => setStart("trainer")} className={KNOPF}>
          <UserCog size={16} /> Trainer ändern
        </button>
        <button type="button" onClick={() => setStart("betreuer")} className={KNOPF}>
          <HeartHandshake size={16} /> Betreuer ändern
        </button>
        <button type="button" onClick={() => setStart("altersklasse")} className={KNOPF}>
          <Layers size={16} /> Altersklasse ändern
        </button>
        <button type="button" onClick={() => setStart("disziplin")} className={KNOPF}>
          <Tag size={16} /> Disziplin ändern
        </button>
        <button type="button" onClick={() => setStart("uebersicht")} className={KNOPF}>
          <Pencil size={16} /> Gruppe bearbeiten
        </button>
      </div>
      <form
        action={gruppeLoeschen}
        onSubmit={(e) => {
          if (!confirm(`„${gruppe.name}“ wirklich löschen? Dabei werden auch alle Trainingstermine, der Gruppenchat, Abmeldungen und die Anwesenheitsliste dieser Gruppe endgültig gelöscht.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="gruppe_id" value={gruppe.id} />
        <input type="hidden" name="zurueck" value="1" />
        <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-semibold text-brand-red hover:underline">
          <Trash2 size={14} /> Gruppe löschen
        </button>
      </form>
      {start && (
        <GruppenAssistent
          vereinId={vereinId}
          gruppe={gruppe}
          start={start}
          altersklassen={altersklassen}
          disziplinen={disziplinen}
          freieAltersklassen={freieAltersklassen}
          onSchliessen={() => setStart(null)}
        />
      )}
    </div>
  );
}
