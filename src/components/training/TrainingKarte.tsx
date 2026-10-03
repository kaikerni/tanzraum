"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock, MapPin, ClipboardCheck, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { abmeldungZuruecknehmen } from "@/app/dashboard/training/actions";
import { grundAnzeige } from "@/lib/training/abmeldegruende";
import type { TrainingsTag, TrainingPerson, TrainingsAbmeldung } from "@/lib/training/getTraining";
import { AbmeldeDialog, vorname, type AbmeldeModus } from "./AbmeldeDialog";

type Dialog = { modus: AbmeldeModus; person?: { vmId: string; name: string; kategorie?: string | null; hinweis?: string | null } } | null;

function zeitpunkt(iso: string, heute: string): string {
  const d = new Date(iso);
  const tag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
  const uhr = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const gestern = new Date(`${heute}T12:00:00Z`);
  gestern.setUTCDate(gestern.getUTCDate() - 1);
  if (tag === heute) return `heute, ${uhr} Uhr`;
  if (tag === gestern.toISOString().slice(0, 10)) return `gestern, ${uhr} Uhr`;
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })}, ${uhr} Uhr`;
}

function Grund({ kategorie, hinweis, grund }: { kategorie: string | null; hinweis: string | null; grund?: string | null }) {
  const g = grundAnzeige(kategorie, hinweis, grund);
  return (
    <>
      <span aria-hidden>{g.emoji}</span> {g.label}
      {g.hinweis ? ` – ${g.hinweis}` : ""}
    </>
  );
}

// Teilnahme einer Person (du selbst bzw. dein Kind): Standard eingeplant, rot nur mit Abmeldung
function Teilnahme({
  p,
  vergangen,
  onAbmelden,
  onMeldung,
  gruppeId,
  datum,
}: {
  p: TrainingPerson;
  vergangen: boolean;
  onAbmelden: () => void;
  onMeldung: (text: string, fehler?: boolean) => void;
  gruppeId: string;
  datum: string;
}) {
  const [laeuft, starte] = useTransition();
  const vn = vorname(p.name);

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl border px-3.5 py-3 ${
        p.abgemeldet ? "border-brand-red/25 bg-brand-red-wash/60" : "border-brand-green/25 bg-brand-green-wash/60"
      }`}
    >
      {!p.ich && (
        <div className="text-[14.5px] font-bold text-brand-ink [overflow-wrap:anywhere]">
          <span aria-hidden>🧒</span> {p.name}
        </div>
      )}
      {p.abgemeldet ? (
        <div className="text-[14.5px] text-brand-ink">
          <p className="font-bold">
            <span aria-hidden>🔴</span> {p.ich ? "Du bist" : `${vn} ist`} für dieses Training abgemeldet.
          </p>
          <p className="mt-0.5 [overflow-wrap:anywhere]">
            Grund: <Grund kategorie={p.kategorie} hinweis={p.hinweis} grund={p.grund} />
          </p>
        </div>
      ) : (
        <p className="text-[14.5px] font-bold text-brand-ink">
          <span aria-hidden>🟢</span> {p.ich ? "Du bist" : `${vn} ist`} eingeplant
        </p>
      )}
      {!vergangen &&
        (p.abgemeldet ? (
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const r = await abmeldungZuruecknehmen(gruppeId, datum, p.vmId);
                onMeldung(r.error ?? (p.ich ? "Du bist wieder eingeplant." : `${vn} ist wieder eingeplant.`), !!r.error);
              })
            }
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-brand-line bg-white px-4 text-[14.5px] font-bold text-brand-ink hover:bg-brand-bg disabled:opacity-60 sm:w-auto sm:self-start"
          >
            <span aria-hidden>↩️</span> {p.ich ? "Wieder anmelden" : `${vn} wieder anmelden`}
          </button>
        ) : (
          <button
            type="button"
            onClick={onAbmelden}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red px-4 text-[14.5px] font-extrabold uppercase tracking-wide text-white shadow-sm hover:bg-brand-red-deep sm:w-auto sm:self-start [overflow-wrap:anywhere]"
          >
            <span aria-hidden>❌</span> {p.ich ? "Vom Training abmelden" : `${vn} abmelden`}
          </button>
        ))}
    </div>
  );
}

function Zusammenfassung({ liste }: { liste: TrainingsAbmeldung[] }) {
  const zaehler = new Map<string, { emoji: string; label: string; n: number }>();
  for (const a of liste) {
    const g = grundAnzeige(a.kategorie, null, a.grund);
    const key = `${g.emoji}${g.label}`;
    zaehler.set(key, { emoji: g.emoji, label: g.label, n: (zaehler.get(key)?.n ?? 0) + 1 });
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Gründe">
      {[...zaehler.values()]
        .sort((a, b) => b.n - a.n)
        .map((z) => (
          <li key={z.emoji + z.label} className="rounded-full bg-brand-bg px-2.5 py-1 text-[12.5px] font-semibold text-brand-ink">
            <span aria-hidden>{z.emoji}</span> {z.n} × {z.label}
          </li>
        ))}
    </ul>
  );
}

// Abmeldungen einer betreuten Gruppe: Zahl auf einen Blick, Namen + Gruende erst nach dem Oeffnen
function TrainerAbmeldungen({
  t,
  heute,
  onBearbeiten,
  onNeu,
  onMeldung,
}: {
  t: TrainingsTag;
  heute: string;
  onBearbeiten: (a: TrainingsAbmeldung) => void;
  onNeu: () => void;
  onMeldung: (text: string, fehler?: boolean) => void;
}) {
  const liste = t.abmeldungen ?? [];
  const [offen, setOffen] = useState(false);
  const [loeschen, setLoeschen] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function entfernen(a: TrainingsAbmeldung) {
    starte(async () => {
      const r = await abmeldungZuruecknehmen(t.gruppeId, t.datum, a.vmId);
      setLoeschen(null);
      onMeldung(r.error ?? `Abmeldung von ${a.name} entfernt.`, !!r.error);
    });
  }

  function Aktionen({ a }: { a: TrainingsAbmeldung }) {
    if (!t.darfVerwalten) return null;
    return loeschen === a.vmId ? (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={laeuft}
          onClick={() => entfernen(a)}
          className="inline-flex min-h-10 items-center rounded-xl bg-brand-red px-3 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          Ja, entfernen
        </button>
        <button type="button" onClick={() => setLoeschen(null)} className="inline-flex min-h-10 items-center rounded-xl border border-brand-line px-3 text-[13px] font-semibold">
          Abbrechen
        </button>
      </div>
    ) : (
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => onBearbeiten(a)}
          aria-label={`Abmeldung von ${a.name} bearbeiten`}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-line text-brand-ink hover:bg-brand-bg"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={() => setLoeschen(a.vmId)}
          aria-label={`Abmeldung von ${a.name} entfernen`}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-line text-brand-red hover:bg-brand-red-wash"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="@container flex flex-col gap-2.5 rounded-2xl border border-brand-line bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-bold text-brand-ink">
          {liste.length === 0 ? (
            <>
              <span aria-hidden>🟢</span> Keine Abmeldungen
            </>
          ) : (
            <>
              <span aria-hidden>🔴</span> {liste.length} {liste.length === 1 ? "Abmeldung" : "Abmeldungen"}
            </>
          )}
        </p>
        {liste.length > 0 && (
          <button
            type="button"
            onClick={() => setOffen((o) => !o)}
            aria-expanded={offen}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-line px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            {offen ? "Ausblenden" : "Abmeldungen anzeigen"}
            <ChevronDown size={16} className={offen ? "rotate-180" : ""} />
          </button>
        )}
      </div>

      {offen && liste.length > 0 && (
        <>
          <Zusammenfassung liste={liste} />
          {/* Schmale Karte (Handy, halbe Breite): Liste */}
          <ul className="flex flex-col divide-y divide-brand-line @xl:hidden">
            {liste.map((a) => (
              <li key={a.vmId} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold text-brand-ink [overflow-wrap:anywhere]">
                    <span aria-hidden>{grundAnzeige(a.kategorie, null, a.grund).emoji}</span> {a.name}
                  </p>
                  <p className="text-[13.5px] text-brand-ink [overflow-wrap:anywhere]">
                    {grundAnzeige(a.kategorie, a.hinweis, a.grund).label}
                    {a.hinweis ? ` – ${a.hinweis}` : ""}
                  </p>
                  <p className="text-[12px] text-brand-ink-soft">Abgemeldet {zeitpunkt(a.erstelltAm, heute)}</p>
                </div>
                <Aktionen a={a} />
              </li>
            ))}
          </ul>
          {/* Breite Karte (Desktop): Tabelle Name | Grund | Zeitpunkt */}
          <table className="hidden w-full table-fixed text-left text-[13.5px] @xl:table">
            <thead>
              <tr className="border-b border-brand-line text-[12px] uppercase tracking-wide text-brand-ink-soft">
                <th className="w-[38%] py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Grund</th>
                <th className="w-[24%] py-2 pr-3 font-semibold">Zeitpunkt</th>
                {t.darfVerwalten && <th className="w-[112px] py-2 font-semibold"><span className="sr-only">Aktionen</span></th>}
              </tr>
            </thead>
            <tbody>
              {liste.map((a) => (
                <tr key={a.vmId} className="border-b border-brand-line last:border-0 align-top">
                  <td className="py-2.5 pr-3 font-semibold text-brand-ink [overflow-wrap:anywhere]">{a.name}</td>
                  <td className="py-2.5 pr-3 text-brand-ink [overflow-wrap:anywhere]">
                    <Grund kategorie={a.kategorie} hinweis={a.hinweis} grund={a.grund} />
                  </td>
                  <td className="py-2.5 pr-3 text-brand-ink-soft">{zeitpunkt(a.erstelltAm, heute)}</td>
                  {t.darfVerwalten && (
                    <td className="py-1.5">
                      <Aktionen a={a} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {t.darfVerwalten && (
        <button
          type="button"
          onClick={onNeu}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-ink/30 px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg sm:w-auto sm:self-start"
        >
          <Plus size={16} /> Abmeldung eintragen
        </button>
      )}
    </div>
  );
}

// Ein Trainingstermin: eigene Teilnahme/Teilnahme der Kinder und – fuer betreute Gruppen – die Abmeldungen
export function TrainingKarte({ t, heute, zeigeVerein = true }: { t: TrainingsTag; heute: string; zeigeVerein?: boolean }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const vergangen = t.datum < heute;
  const zeit = `${t.von}–${t.bis} Uhr`;

  function melde(text: string, fehler = false) {
    setMeldung({ text, fehler });
  }

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-extrabold leading-snug text-brand-ink [overflow-wrap:anywhere]">{t.titel || t.gruppeName}</h3>
          {(t.titel || zeigeVerein) && (
            <p className="text-[12.5px] text-brand-ink-soft [overflow-wrap:anywhere]">
              {t.titel ? t.gruppeName : ""}
              {t.titel && zeigeVerein ? " · " : ""}
              {zeigeVerein ? t.vereinName : ""}
            </p>
          )}
        </div>
        {t.darfAnwesenheit && !(t.datum > heute) && (
          <Link
            href={`/dashboard/anwesenheit?gruppe=${t.gruppeId}&datum=${t.datum}`}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-navy px-3 text-[13px] font-semibold text-white hover:opacity-90"
          >
            <ClipboardCheck size={15} /> <span className="hidden sm:inline">Anwesenheit</span>
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-brand-ink">
        <span className="flex items-center gap-1.5">
          <Clock size={14} className="text-brand-ink-soft" />
          {zeit}
        </span>
        {t.halle && (
          <span className="flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
            <MapPin size={14} className="shrink-0 text-brand-ink-soft" />
            {t.halle}
          </span>
        )}
      </div>

      {t.personen.map((p) => (
        <Teilnahme
          key={p.vmId}
          p={p}
          vergangen={vergangen}
          gruppeId={t.gruppeId}
          datum={t.datum}
          onMeldung={melde}
          onAbmelden={() => {
            setMeldung(null);
            setDialog({ modus: p.ich ? "selbst" : "kind", person: { vmId: p.vmId, name: p.name } });
          }}
        />
      ))}

      {t.abmeldungen && (
        <TrainerAbmeldungen
          t={t}
          heute={heute}
          onMeldung={melde}
          onNeu={() => {
            setMeldung(null);
            setDialog({ modus: "trainer" });
          }}
          onBearbeiten={(a) => {
            setMeldung(null);
            setDialog({ modus: "trainer", person: { vmId: a.vmId, name: a.name, kategorie: a.kategorie, hinweis: a.hinweis } });
          }}
        />
      )}

      {meldung && (
        <p role="status" className={meldung.fehler ? "form-error" : "text-[13px] font-semibold text-brand-green"}>
          {meldung.text}
        </p>
      )}

      {dialog && (
        <AbmeldeDialog
          modus={dialog.modus}
          person={dialog.person}
          heute={heute}
          ziel={{ vereinId: t.vereinId, gruppeId: t.gruppeId, gruppeName: t.titel || t.gruppeName, datum: t.datum, zeit }}
          onSchliessen={() => setDialog(null)}
          onFertig={(text) => {
            setDialog(null);
            melde(text);
          }}
        />
      )}
    </article>
  );
}
