"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Search, Users, UserMinus, LogOut, UserPlus, Pencil } from "lucide-react";
import {
  gruppenchatEntfernen,
  gruppenchatErstellen,
  gruppenchatHinzufuegen,
  gruppenchatKandidaten,
  gruppenchatMitglieder,
  gruppenchatUmbenennen,
  gruppenchatVerlassen,
  type GruppenKandidat,
  type GruppenMitglied,
} from "@/app/dashboard/nachrichten/actions";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { Dialog } from "@/components/ui/Dialog";
import { ChatAvatar } from "./ChatAvatar";

// Auswahl von Personen (Verein, Familie, Buddys – nur wer in einen Gruppenchat aufgenommen werden darf)
function Auswahl({ kandidaten, gewaehlt, setGewaehlt }: { kandidaten: GruppenKandidat[]; gewaehlt: string[]; setGewaehlt: (ids: string[]) => void }) {
  const [filter, setFilter] = useState("");
  const liste = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? kandidaten.filter((k) => `${k.anzeige} ${k.handle ?? ""} ${k.grund}`.toLowerCase().includes(q)) : kandidaten;
  }, [kandidaten, filter]);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-10 items-center gap-2 rounded-xl bg-brand-bg px-3 text-brand-ink-soft">
        <Search size={16} />
        <span className="sr-only">Personen filtern</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name suchen" className="min-w-0 flex-1 bg-transparent text-[14px] text-brand-ink outline-none" />
      </label>
      {liste.length === 0 ? (
        <p className="px-2 py-4 text-center text-[13px] text-brand-ink-soft">
          {kandidaten.length === 0 ? "Noch niemand zum Hinzufügen. Gruppenchats sind mit Buddys, Vereinsmitgliedern und Familie ab 16 Jahren möglich (ab BASIC)." : "Niemand gefunden."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {liste.map((k) => {
            const an = gewaehlt.includes(k.userId);
            return (
              <li key={k.userId}>
                <button
                  type="button"
                  aria-pressed={an}
                  onClick={() => setGewaehlt(an ? gewaehlt.filter((x) => x !== k.userId) : [...gewaehlt, k.userId])}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-brand-bg"
                >
                  <ChatAvatar typ="dm" name={k.anzeige} avatarUrl={k.avatarUrl} groesse={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-brand-ink">{k.anzeige}</span>
                    <span className="block truncate text-[12.5px] text-brand-ink-soft">{k.grund}</span>
                  </span>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${an ? "border-brand-red bg-brand-red text-white" : "border-brand-line"}`}>
                    {an && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Neuer Gruppenchat (ab BASIC)
export function NeuerGruppenchat({ kandidaten }: { kandidaten: GruppenKandidat[] }) {
  const [name, setName] = useState("");
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex min-h-[60px] items-center gap-2 border-b border-brand-line px-2 sm:px-4">
        <Link href="/dashboard/nachrichten/gruppen" aria-label="Zurück" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-[17px] font-bold text-brand-ink">Neuer Gruppenchat</h2>
      </header>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          starte(async () => setMeldung(await gruppenchatErstellen(name, gewaehlt)));
        }}
      >
        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          <label className="field mb-3">
            <span>Name der Gruppe</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="z. B. Garde-Freunde" />
          </label>
          <p className="mb-2 text-[13px] font-semibold text-brand-ink">Mitglieder auswählen ({gewaehlt.length})</p>
          <Auswahl kandidaten={kandidaten} gewaehlt={gewaehlt} setGewaehlt={setGewaehlt} />
        </div>
        <div className="border-t border-brand-line px-3 py-3 sm:px-4">
          {meldung && <Meldung ergebnis={meldung} />}
          <button type="submit" disabled={laeuft || !name.trim() || gewaehlt.length === 0} className="btn-primary mt-1 w-full disabled:opacity-50">
            <Users size={17} /> Gruppenchat erstellen
          </button>
        </div>
      </form>
    </div>
  );
}

// Gruppeninfo im Chatkopf: Mitglieder, hinzufuegen/entfernen und umbenennen (Ersteller/in), verlassen (alle)
export function GruppenchatInfo({ gespraechId, name, istLeitung, onSchliessen }: { gespraechId: string; name: string; istLeitung: boolean; onSchliessen: () => void }) {
  const [mitglieder, setMitglieder] = useState<GruppenMitglied[] | null>(null);
  const [kandidaten, setKandidaten] = useState<GruppenKandidat[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [neuerName, setNeuerName] = useState(name);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const laden = () => starte(async () => setMitglieder(await gruppenchatMitglieder(gespraechId)));
  useEffect(laden, [gespraechId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tue = (aktion: () => Promise<AktionsErgebnis>, danach?: () => void) =>
    starte(async () => {
      const r = await aktion();
      setMeldung(r);
      if (!r.error) {
        danach?.();
        setMitglieder(await gruppenchatMitglieder(gespraechId));
      }
    });

  return (
    <Dialog titel={name} untertitel={mitglieder ? `Gruppenchat · ${mitglieder.length} Mitglieder` : "Gruppenchat"} onSchliessen={onSchliessen}>
      <div className="flex flex-col gap-4">
        {meldung && <Meldung ergebnis={meldung} />}
        {istLeitung && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              tue(() => gruppenchatUmbenennen(gespraechId, neuerName));
            }}
          >
            <label className="field min-w-0 flex-1">
              <span>Name</span>
              <input value={neuerName} onChange={(e) => setNeuerName(e.target.value)} maxLength={60} required />
            </label>
            <button type="submit" disabled={laeuft} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-line px-3 text-[13px] font-semibold text-brand-ink">
              <Pencil size={14} /> Speichern
            </button>
          </form>
        )}
        <section>
          <h3 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Mitglieder</h3>
          <ul className="flex flex-col">
            {(mitglieder ?? []).map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-1 py-1.5">
                <ChatAvatar typ="dm" name={m.anzeige} avatarUrl={m.avatarUrl} groesse={36} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-brand-ink">
                  {m.ich ? "Du" : m.anzeige}
                  {m.istLeitung && <span className="ml-2 rounded-full bg-brand-gold-wash px-2 py-0.5 text-[11px] font-semibold text-brand-gold">Gruppenleitung</span>}
                </span>
                {istLeitung && !m.ich && (
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => confirm(`${m.anzeige} aus der Gruppe entfernen?`) && tue(() => gruppenchatEntfernen(gespraechId, m.userId))}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-bg hover:text-brand-red"
                    aria-label={`${m.anzeige} entfernen`}
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
        {istLeitung && (
          <section className="flex flex-col gap-2">
            {kandidaten === null ? (
              <button
                type="button"
                onClick={() => starte(async () => setKandidaten(await gruppenchatKandidaten()))}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-line text-[13.5px] font-semibold text-brand-ink"
              >
                <UserPlus size={16} /> Mitglieder hinzufügen
              </button>
            ) : (
              <>
                <Auswahl kandidaten={kandidaten.filter((k) => !(mitglieder ?? []).some((m) => m.userId === k.userId))} gewaehlt={gewaehlt} setGewaehlt={setGewaehlt} />
                <button
                  type="button"
                  disabled={laeuft || gewaehlt.length === 0}
                  onClick={() => tue(() => gruppenchatHinzufuegen(gespraechId, gewaehlt), () => setGewaehlt([]))}
                  className="btn-primary disabled:opacity-50"
                >
                  <UserPlus size={16} /> {gewaehlt.length || ""} hinzufügen
                </button>
              </>
            )}
          </section>
        )}
        <button
          type="button"
          disabled={laeuft}
          onClick={() => confirm("Gruppe verlassen? Du siehst die Nachrichten danach nicht mehr.") && starte(async () => setMeldung(await gruppenchatVerlassen(gespraechId)))}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-red/40 text-[13.5px] font-semibold text-brand-red"
        >
          <LogOut size={16} /> Gruppe verlassen
        </button>
      </div>
    </Dialog>
  );
}
