import type { WochenBeteiligung } from "@/lib/dashboard/getDashboardUebersicht";

function kalenderwoche(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const wochentag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - wochentag);
  const jahresanfang = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - jahresanfang.getTime()) / 86400000 + 1) / 7);
}

const TICKS = [100, 75, 50, 25, 0];

export function BeteiligungDiagramm({ verlauf }: { verlauf: WochenBeteiligung[] }) {
  const leer = verlauf.every((w) => w.prozent === null);

  return (
    <figure className="m-0">
      <div className="relative flex h-[168px] gap-2">
        <div className="flex h-[140px] w-8 shrink-0 flex-col justify-between text-right text-[10.5px] text-brand-ink-faint">
          {TICKS.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {t}%
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[140px] flex-col justify-between">
            {TICKS.map((t) => (
              <div key={t} className={`h-px w-full ${t === 0 ? "bg-brand-line" : "bg-brand-line/60"}`} />
            ))}
          </div>

          {leer ? (
            <div className="absolute inset-x-0 top-0 flex h-[140px] items-center justify-center">
              <p className="rounded-lg bg-white/90 px-3 py-1.5 text-[12.5px] text-brand-ink-soft">
                Noch keine Anwesenheitsdaten erfasst.
              </p>
            </div>
          ) : null}

          <div className="relative flex h-full items-start gap-[2px]">
            {verlauf.map((w) => {
              const kw = kalenderwoche(w.wocheStart);
              const hoehe = w.prozent === null ? 0 : (w.prozent / 100) * 140;
              return (
                <div key={w.wocheStart} className="group relative flex h-full flex-1 flex-col items-center">
                  <div className="relative flex h-[140px] w-full items-end justify-center">
                    {w.prozent !== null && (
                      <>
                        <span
                          className="absolute text-[10.5px] font-semibold text-brand-ink-soft"
                          style={{ bottom: `${hoehe + 4}px` }}
                        >
                          {Math.round(w.prozent)}%
                        </span>
                        <div
                          className="w-[62%] max-w-9 rounded-t bg-brand-green-light transition-colors group-hover:bg-brand-green"
                          style={{ height: `${Math.max(hoehe, 2)}px` }}
                        />
                      </>
                    )}
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-brand-navy px-2 py-1 text-[11px] font-medium text-white group-hover:block"
                    >
                      KW {kw}: {w.prozent === null ? "keine Daten" : `${w.prozent.toLocaleString("de-DE")} % anwesend`}
                    </span>
                  </div>
                  <div className="mt-1.5 text-center text-[10.5px] leading-tight text-brand-ink-faint">
                    KW
                    <br />
                    {kw}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>Trainingsbeteiligung je Kalenderwoche</caption>
        <thead>
          <tr>
            <th scope="col">Kalenderwoche</th>
            <th scope="col">Anwesend</th>
          </tr>
        </thead>
        <tbody>
          {verlauf.map((w) => (
            <tr key={w.wocheStart}>
              <td>KW {kalenderwoche(w.wocheStart)}</td>
              <td>{w.prozent === null ? "keine Daten" : `${w.prozent} %`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
