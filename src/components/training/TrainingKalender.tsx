"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock, MapPin, ClipboardCheck, UserMinus, Undo2 } from "lucide-react";
import { abmelden, abmeldungZuruecknehmen } from "@/app/dashboard/training/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { TrainingsTag, TrainingPerson } from "@/lib/training/getTraining";

const KNOPF =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold disabled:opacity-50";

function tagesTitel(iso: string, heute: string, morgen: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const text = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  if (iso === heute) return `Heute · ${text}`;
  if (iso === morgen) return `Morgen · ${text}`;
  return text;
}

function PersonZeile({ t, p, heute }: { t: TrainingsTag; p: TrainingPerson; heute: string }) {
  const [laeuft, starte] = useTransition();
  const [grundOffen, setGrundOffen] = useState(false);
  const [grund, setGrund] = useState("");
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const vergangen = t.datum < heute;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-bg px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold text-brand-ink">
          {p.ich ? "Du" : p.name}
          {p.abgemeldet ? (
            <span className="status-badge abgesagt ml-2 align-middle">abgemeldet</span>
          ) : (
            <span className="status-badge zugesagt ml-2 align-middle">dabei</span>
          )}
        </span>
        {!vergangen &&
          (p.abgemeldet ? (
            <button
              type="button"
              disabled={laeuft}
              onClick={() => starte(async () => setMeldung(await abmeldungZuruecknehmen(t.gruppeId, t.datum, p.vmId)))}
              className={`${KNOPF} border-brand-line bg-white text-brand-ink hover:bg-brand-bg`}
            >
              <Undo2 size={15} /> Doch dabei
            </button>
          ) : (
            !grundOffen && (
              <button
                type="button"
                onClick={() => setGrundOffen(true)}
                className={`${KNOPF} border-brand-red/30 bg-white text-brand-red hover:bg-brand-red-wash`}
              >
                <UserMinus size={15} /> Abmelden
              </button>
            )
          ))}
      </div>
      {p.abgemeldet && p.grund && <p className="text-[12.5px] text-brand-ink-soft">Grund: {p.grund}</p>}
      {grundOffen && !p.abgemeldet && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            starte(async () => {
              const ergebnis = await abmelden(t.vereinId, t.gruppeId, t.datum, p.vmId, grund);
              setMeldung(ergebnis);
              if (!ergebnis.error) setGrundOffen(false);
            });
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <label className="sr-only" htmlFor={`grund-${t.terminId}-${t.datum}-${p.vmId}`}>
            Grund (optional)
          </label>
          <input
            id={`grund-${t.terminId}-${t.datum}-${p.vmId}`}
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            maxLength={300}
            placeholder="Grund (optional), z. B. krank"
            className="min-h-10 flex-1 rounded-xl border border-brand-line bg-white px-3 text-[13.5px] outline-none focus:border-brand-red"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={laeuft} className={`${KNOPF} border-brand-red bg-brand-red text-white hover:bg-brand-red-deep`}>
              Abmelden
            </button>
            <button type="button" onClick={() => setGrundOffen(false)} className={`${KNOPF} border-brand-line bg-white text-brand-ink-soft`}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
    </div>
  );
}

export function TrainingKalender({ tage, heute, morgen }: { tage: TrainingsTag[]; heute: string; morgen: string }) {
  if (tage.length === 0) {
    return (
      <p className="rounded-[var(--radius-l)] border border-brand-line bg-white p-5 text-[14px] text-brand-ink-soft shadow-[var(--shadow)]">
        In den nächsten zwei Wochen stehen keine Trainings für dich an.
      </p>
    );
  }

  const nachTag = new Map<string, TrainingsTag[]>();
  for (const t of tage) nachTag.set(t.datum, [...(nachTag.get(t.datum) ?? []), t]);

  return (
    <div className="flex flex-col gap-5">
      {[...nachTag.entries()].map(([datum, liste]) => (
        <section key={datum}>
          <h2 className={`mb-2 text-[14px] font-bold ${datum === heute ? "text-brand-red" : "text-brand-ink"}`}>
            {tagesTitel(datum, heute, morgen)}
          </h2>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {liste.map((t) => (
              <li key={`${t.terminId}-${t.datum}`} className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-bold text-brand-ink">{t.titel || t.gruppeName}</div>
                    <div className="text-[12.5px] text-brand-ink-soft">
                      {t.titel ? `${t.gruppeName} · ` : ""}
                      {t.vereinName}
                    </div>
                  </div>
                  {t.darfAnwesenheit && (
                    <Link
                      href={`/dashboard/anwesenheit?gruppe=${t.gruppeId}&datum=${t.datum}`}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-navy px-3 text-[13px] font-semibold text-white hover:opacity-90"
                    >
                      <ClipboardCheck size={15} /> Anwesenheit
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-brand-ink">
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} className="text-brand-ink-soft" />
                    {t.von}–{t.bis} Uhr
                  </span>
                  {t.halle && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-brand-ink-soft" />
                      {t.halle}
                    </span>
                  )}
                </div>
                {t.personen.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {t.personen.map((p) => (
                      <PersonZeile key={p.vmId} t={t} p={p} heute={heute} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
