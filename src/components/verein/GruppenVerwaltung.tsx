"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { gruppeSpeichern, gruppeLoeschen } from "@/app/dashboard/verein/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { Auswahl, GruppeUebersicht } from "@/lib/verein/getVerein";

function GruppenFormular({
  vereinId,
  gruppe,
  altersklassen,
  disziplinen,
  fertig,
}: {
  vereinId: string;
  gruppe?: GruppeUebersicht;
  altersklassen: Auswahl[];
  disziplinen: Auswahl[];
  fertig?: () => void;
}) {
  const [ergebnis, aktion] = useActionState(gruppeSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3 rounded-xl border border-brand-line bg-brand-bg p-3.5">
      <input type="hidden" name="verein_id" value={vereinId} />
      {gruppe && <input type="hidden" name="gruppe_id" value={gruppe.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Gruppenname</span>
          <input name="name" defaultValue={gruppe?.name ?? ""} required placeholder="z. B. Jugendgarde" />
        </label>
        <label className="field">
          <span>Thema (Pflicht bei Schautanz)</span>
          <input name="thema" defaultValue={gruppe?.thema ?? ""} />
        </label>
        <label className="field">
          <span>Altersklasse</span>
          <select name="altersklasse_id" defaultValue={gruppe?.altersklasseId ?? ""}>
            <option value="">– keine –</option>
            {altersklassen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Disziplin</span>
          <select name="disziplin_id" defaultValue={gruppe?.disziplinId ?? ""}>
            <option value="">– keine –</option>
            {disziplinen.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div className="flex gap-2">
        <SendenButton>{gruppe ? "Speichern" : "Gruppe anlegen"}</SendenButton>
        {fertig && (
          <button type="button" onClick={fertig} className="rounded-xl px-4 py-2 text-[13.5px] text-brand-ink-soft hover:bg-white">
            Schließen
          </button>
        )}
      </div>
    </form>
  );
}

export function GruppenVerwaltung({
  vereinId,
  gruppen,
  darfVerwalten,
  altersklassen,
  disziplinen,
}: {
  vereinId: string;
  gruppen: GruppeUebersicht[];
  darfVerwalten: boolean;
  altersklassen: Auswahl[];
  disziplinen: Auswahl[];
}) {
  const [bearbeiten, setBearbeiten] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {gruppen.length === 0 && (
        <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">Noch keine Gruppen angelegt.</p>
      )}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {gruppen.map((g) =>
          bearbeiten === g.id ? (
            <li key={g.id} className="md:col-span-2">
              <GruppenFormular
                vereinId={vereinId}
                gruppe={g}
                altersklassen={altersklassen}
                disziplinen={disziplinen}
                fertig={() => setBearbeiten(null)}
              />
            </li>
          ) : (
            <li key={g.id} className="rounded-xl border border-brand-line p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold text-brand-ink">{g.name ?? "Ohne Namen"}</div>
                  <div className="text-[12.5px] text-brand-ink-soft">
                    {[g.altersklasse, g.disziplin, g.thema].filter(Boolean).join(" · ") || "Keine Angaben"}
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-brand-ink">
                  <Users size={14} className="text-brand-green" />
                  {g.anzahl}
                </span>
              </div>
              <div className="mt-2 text-[12.5px] text-brand-ink">
                <span className="text-brand-ink-soft">Trainer: </span>
                {g.trainer.length > 0 ? g.trainer.join(", ") : "noch keiner"}
                {g.betreuer.length > 0 && (
                  <>
                    <span className="text-brand-ink-soft"> · Betreuer: </span>
                    {g.betreuer.join(", ")}
                  </>
                )}
              </div>
              {darfVerwalten && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBearbeiten(g.id)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-bg"
                  >
                    <Pencil size={13} /> Bearbeiten
                  </button>
                  <form
                    action={gruppeLoeschen}
                    onSubmit={(e) => {
                      if (!confirm(`Gruppe „${g.name}“ wirklich löschen? Dabei werden auch alle Trainingstermine, der Gruppenchat, Abmeldungen und die Anwesenheitsliste dieser Gruppe endgültig gelöscht.`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="gruppe_id" value={g.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-red/30 px-3 text-[12.5px] font-medium text-brand-red hover:bg-brand-red-wash"
                    >
                      <Trash2 size={13} /> Löschen
                    </button>
                  </form>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
      {darfVerwalten &&
        (neu ? (
          <GruppenFormular vereinId={vereinId} altersklassen={altersklassen} disziplinen={disziplinen} fertig={() => setNeu(false)} />
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setNeu(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-dashed border-brand-line px-4 text-[13.5px] font-semibold text-brand-ink hover:border-brand-red hover:text-brand-red"
            >
              <Plus size={16} /> Neue Gruppe
            </button>
          </div>
        ))}
    </div>
  );
}
