// Schlanke SVG-Diagramme fuer die TanzRaum-Administration (ohne Bibliothek, serverseitig gerendert).
// Alle Werte sind aggregiert – es werden keine Personendaten dargestellt.

export type Segment = { label: string; wert: number; farbe: string };

export function Donut({ segmente, mitte, untertitel }: { segmente: Segment[]; mitte: string; untertitel?: string }) {
  const summe = segmente.reduce((s, x) => s + x.wert, 0);
  const r = 42;
  const umfang = 2 * Math.PI * r;
  let versatz = 0;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label={segmente.map((s) => `${s.label}: ${s.wert}`).join(", ")}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e8eaf0" strokeWidth="16" />
        {summe > 0 &&
          segmente.map((s) => {
            const laenge = (s.wert / summe) * umfang;
            const el = (
              <circle
                key={s.label}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={s.farbe}
                strokeWidth="16"
                strokeDasharray={`${laenge} ${umfang - laenge}`}
                strokeDashoffset={-versatz}
                transform="rotate(-90 60 60)"
              />
            );
            versatz += laenge;
            return el;
          })}
        <text x="60" y="58" textAnchor="middle" className="fill-brand-ink text-[20px] font-extrabold">
          {mitte}
        </text>
        {untertitel && (
          <text x="60" y="75" textAnchor="middle" className="fill-brand-ink-soft text-[9px]">
            {untertitel}
          </text>
        )}
      </svg>
      <ul className="flex flex-col gap-1.5 text-[13px]">
        {segmente.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.farbe }} />
            <span className="text-brand-ink">{s.label}</span>
            <span className="ml-auto pl-3 font-semibold tabular-nums text-brand-ink">{s.wert}</span>
            <span className="w-10 text-right tabular-nums text-brand-ink-faint">{summe > 0 ? `${Math.round((s.wert / summe) * 100)} %` : "–"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Balken({ werte, farbe = "#e11d2e", hoehe = 150 }: { werte: { label: string; wert: number }[]; farbe?: string; hoehe?: number }) {
  const max = Math.max(1, ...werte.map((w) => w.wert));
  const breite = 100 / Math.max(1, werte.length);
  return (
    <div>
      <svg viewBox={`0 0 100 ${hoehe / 3}`} preserveAspectRatio="none" className="w-full" style={{ height: hoehe }} role="img" aria-label={werte.map((w) => `${w.label}: ${w.wert}`).join(", ")}>
        {werte.map((w, i) => {
          const h = (w.wert / max) * (hoehe / 3 - 2);
          return <rect key={w.label} x={i * breite + breite * 0.15} y={hoehe / 3 - h} width={breite * 0.7} height={Math.max(h, w.wert > 0 ? 0.6 : 0)} rx="0.8" fill={farbe} opacity={i === werte.length - 1 ? 1 : 0.75} />;
        })}
      </svg>
      <div className="mt-1 flex text-[10.5px] text-brand-ink-faint">
        {werte.map((w, i) => (
          <span key={w.label} className="flex-1 text-center tabular-nums">
            {werte.length <= 12 || i % 2 === 0 ? w.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Linie({ werte, farbe = "#1f6feb", hoehe = 150 }: { werte: { label: string; wert: number }[]; farbe?: string; hoehe?: number }) {
  const max = Math.max(1, ...werte.map((w) => w.wert));
  const h = 50;
  const punkte = werte.map((w, i) => [werte.length === 1 ? 50 : (i / (werte.length - 1)) * 100, h - 3 - (w.wert / max) * (h - 8)] as const);
  const pfad = punkte.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const flaeche = punkte.length ? `${pfad} L100,${h} L0,${h} Z` : "";
  const letzter = werte[werte.length - 1];
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: hoehe }} role="img" aria-label={werte.map((w) => `${w.label}: ${w.wert}`).join(", ")}>
          <path d={flaeche} fill={farbe} opacity="0.1" />
          <path d={pfad} fill="none" stroke={farbe} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {letzter && <span className="absolute right-0 top-0 rounded-md bg-white/90 px-1.5 text-[12px] font-bold tabular-nums text-brand-ink">{letzter.wert}</span>}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-brand-ink-faint">
        <span>{werte[0]?.label}</span>
        <span>{letzter?.label}</span>
      </div>
    </div>
  );
}

export function Kennzahl({ label, wert, zusatz, farbe = "text-brand-ink" }: { label: string; wert: number | string; zusatz?: string; farbe?: string }) {
  return (
    <div className="rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)]">
      <div className={`text-[28px] font-extrabold leading-none tabular-nums ${farbe}`}>{wert}</div>
      <div className="mt-1.5 text-[13px] font-semibold text-brand-ink">{label}</div>
      {zusatz && <div className="text-[12px] text-brand-ink-soft">{zusatz}</div>}
    </div>
  );
}
