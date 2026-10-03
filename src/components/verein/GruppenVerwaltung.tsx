"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Zap, ChevronRight, Loader2 } from "lucide-react";
import { gruppeAssistentSpeichern } from "@/app/dashboard/verein/actions";
import type { Auswahl, DisziplinInfo, GruppeUebersicht } from "@/lib/verein/getVerein";
import { GruppenAssistent } from "./GruppenAssistent";
import { staerkeText } from "@/lib/verein/gruppen";

// „Schnell anlegen“: nur der Name – alles Weitere spaeter in der Gruppe
function SchnellAnlegen({ vereinId, fertig }: { vereinId: string; fertig: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        starte(async () => {
          const r = await gruppeAssistentSpeichern({
            vereinId,
            gruppeId: null,
            name,
            altersklasseId: null,
            altersklasseFrei: null,
            disziplinId: null,
            taenzer: [],
            trainer: [],
            betreuer: [],
            personen: false,
          });
          if (r.error) return setFehler(r.error);
          router.push(`/dashboard/verein/gruppen/${r.gruppeId}`);
          fertig();
        });
      }}
      className="flex flex-col gap-2 rounded-2xl border border-brand-line bg-brand-bg p-3.5 sm:flex-row sm:items-end"
    >
      <label className="field flex-1">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoFocus placeholder="z. B. Juniorengarde" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={laeuft} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-[14px] font-semibold text-white disabled:opacity-60">
          {laeuft && <Loader2 size={16} className="animate-spin" />} Gruppe erstellen
        </button>
        <button type="button" onClick={fertig} className="min-h-11 rounded-xl px-3 text-[13.5px] text-brand-ink-soft hover:bg-white">
          Abbrechen
        </button>
      </div>
      {fehler && <p className="form-error sm:basis-full">{fehler}</p>}
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
  disziplinen: DisziplinInfo[];
}) {
  const [assistent, setAssistent] = useState(false);
  const [schnell, setSchnell] = useState(false);
  const freie = [...new Set(gruppen.map((g) => g.altersklasseFrei).filter((x): x is string => !!x))].sort();

  return (
    <div className="flex flex-col gap-3">
      {darfVerwalten && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setAssistent(true)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 text-[15px] font-bold text-white hover:bg-brand-red-deep"
          >
            <Plus size={18} /> Gruppe anlegen
          </button>
          <button
            type="button"
            onClick={() => setSchnell((x) => !x)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-line px-5 text-[14px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            <Zap size={16} /> Schnell anlegen
          </button>
        </div>
      )}
      {schnell && <SchnellAnlegen vereinId={vereinId} fertig={() => setSchnell(false)} />}

      {gruppen.length === 0 ? (
        <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px] text-brand-ink-soft">Noch keine Gruppen angelegt.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {gruppen.map((g) => (
            <li key={g.id} className="min-w-0">
              <Link
                href={`/dashboard/verein/gruppen/${g.id}`}
                className="flex min-h-full items-start gap-3 rounded-2xl border border-brand-line p-4 transition-colors hover:border-brand-red hover:bg-brand-bg/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15.5px] font-bold text-brand-ink [overflow-wrap:anywhere]">{g.name ?? "Ohne Namen"}</div>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-[13px]">
                    <dt className="text-brand-ink-soft">Altersklasse:</dt>
                    <dd className="text-brand-ink [overflow-wrap:anywhere]">{g.altersklasse ?? "–"}</dd>
                    <dt className="text-brand-ink-soft">Disziplin:</dt>
                    <dd className="text-brand-ink [overflow-wrap:anywhere]">{g.disziplin ?? "–"}</dd>
                  </dl>
                  <p className="mt-1.5 text-[13px] font-semibold text-brand-ink">
                    {staerkeText(g)}
                    {g.trainerAnzahl > 0 ? ` · ${g.trainerAnzahl} Trainer` : " · noch kein Trainer"}
                    {g.betreuerAnzahl > 0 ? ` · ${g.betreuerAnzahl} Betreuer` : ""}
                  </p>
                </div>
                <ChevronRight size={18} className="mt-1 shrink-0 text-brand-ink-soft" aria-hidden />
                <span className="sr-only">Gruppe öffnen</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {assistent && (
        <GruppenAssistent
          vereinId={vereinId}
          altersklassen={altersklassen}
          disziplinen={disziplinen}
          freieAltersklassen={freie}
          onSchliessen={() => setAssistent(false)}
        />
      )}
    </div>
  );
}
