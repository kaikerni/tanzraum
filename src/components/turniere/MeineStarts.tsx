import Link from "next/link";
import { Trophy } from "lucide-react";
import { StartRueckmeldung } from "./StartRueckmeldung";
import { datumKurz, STATUS_LABEL, zeitraum, type MeinStart } from "@/lib/turniere/getTurniere";

const STATUS_BADGE = { geplant: "offen", gemeldet: "zugesagt", abgesagt: "abgesagt" } as const;

// Fasst die Zeilen (je Start und Person) zu einem Block pro Start zusammen.
export function MeineStarts({ starts, heute, mitTurnierLink = true }: { starts: MeinStart[]; heute: string; mitTurnierLink?: boolean }) {
  const bloecke = new Map<string, MeinStart[]>();
  for (const s of starts) bloecke.set(s.startId, [...(bloecke.get(s.startId) ?? []), s]);

  return (
    <ul className="flex flex-col gap-3">
      {[...bloecke.values()].map((zeilen) => {
        const s = zeilen[0];
        const vorbei = s.letzterTag < heute;
        return (
          <li key={s.startId} className="flex flex-col gap-2 rounded-2xl border border-brand-line p-3">
            <div className="flex items-start gap-2.5">
              <Trophy size={18} className="mt-0.5 shrink-0 text-brand-gold" />
              <div className="min-w-0 flex-1">
                {mitTurnierLink ? (
                  <Link href={`/dashboard/turniere/${s.turnierId}`} className="text-[14px] font-bold text-brand-ink hover:text-brand-red">
                    {s.turnierName}
                  </Link>
                ) : (
                  <span className="text-[14px] font-bold text-brand-ink">{s.teilnahme}</span>
                )}
                <p className="text-[12.5px] text-brand-ink-soft">
                  {s.tag ? datumKurz(s.tag) : zeitraum(s.ersterTag, s.letzterTag)}
                  {s.startzeit ? ` · ${s.startzeit} Uhr` : ""} · {s.turnierOrt}
                </p>
                <p className="text-[12.5px] text-brand-ink-soft">
                  {mitTurnierLink && <strong className="text-brand-ink">{s.teilnahme}</strong>}
                  {[s.disziplin, s.altersklasse].filter(Boolean).length > 0 && ` · ${[s.disziplin, s.altersklasse].filter(Boolean).join(" · ")}`}
                  {` · ${s.vereinName}`}
                </p>
              </div>
              <span className={`status-badge ${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
            </div>
            {s.status !== "abgesagt" &&
              zeilen.map((z) => (
                <StartRueckmeldung
                  key={z.vmId}
                  startId={z.startId}
                  vmId={z.vmId}
                  name={z.ich ? "Du" : z.person}
                  status={z.rueckmeldung}
                  gesperrt={vorbei}
                />
              ))}
          </li>
        );
      })}
    </ul>
  );
}
