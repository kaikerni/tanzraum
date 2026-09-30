import type { TrainingsTag } from "@/lib/training/getTraining";
import { TrainingKarte } from "./TrainingKarte";

function tagesTitel(iso: string, morgen: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const text = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return iso === morgen ? `Morgen · ${text}` : text;
}

// Heute gross oben, danach die naechsten Termine nach Tagen – jeder Termin einzeln (Abmeldung gilt nur fuer diesen Termin)
export function TrainingKalender({ tage, heute, morgen }: { tage: TrainingsTag[]; heute: string; morgen: string }) {
  const mehrereVereine = new Set(tage.map((t) => t.vereinId)).size > 1;
  const heuteListe = tage.filter((t) => t.datum === heute);
  const nachTag = new Map<string, TrainingsTag[]>();
  for (const t of tage.filter((x) => x.datum > heute)) nachTag.set(t.datum, [...(nachTag.get(t.datum) ?? []), t]);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="training-heute">
        <h2 id="training-heute" className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-brand-red">
          Training heute
        </h2>
        {heuteListe.length === 0 ? (
          <p className="rounded-[var(--radius-l)] border border-brand-line bg-white p-4 text-[14px] text-brand-ink-soft shadow-[var(--shadow)]">
            Heute steht kein Training für dich an.
          </p>
        ) : (
          <ul className={`grid grid-cols-1 gap-3 ${heuteListe.length > 1 ? "xl:grid-cols-2" : ""}`}>
            {heuteListe.map((t) => (
              <li key={`${t.terminId}-${t.datum}`} className="min-w-0">
                <TrainingKarte t={t} heute={heute} zeigeVerein={mehrereVereine} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="training-naechste">
        <h2 id="training-naechste" className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-brand-ink-soft">
          Nächste Trainings
        </h2>
        {nachTag.size === 0 ? (
          <p className="rounded-[var(--radius-l)] border border-brand-line bg-white p-4 text-[14px] text-brand-ink-soft shadow-[var(--shadow)]">
            In den nächsten zwei Wochen stehen keine weiteren Trainings für dich an.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {[...nachTag.entries()].map(([datum, liste]) => (
              <div key={datum}>
                <h3 className="mb-2 text-[14px] font-bold text-brand-ink">{tagesTitel(datum, morgen)}</h3>
                <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {liste.map((t) => (
                    <li key={`${t.terminId}-${t.datum}`} className="min-w-0">
                      <TrainingKarte t={t} heute={heute} zeigeVerein={mehrereVereine} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
