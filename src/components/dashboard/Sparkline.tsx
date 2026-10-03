const B = 200;
const H = 48;

function pfad(punkte: [number, number][]): string {
  if (punkte.length === 1) return `M0,${punkte[0][1]} L${B},${punkte[0][1]}`;
  let d = `M${punkte[0][0]},${punkte[0][1]}`;
  for (let i = 0; i < punkte.length - 1; i++) {
    const [x0, y0] = punkte[i];
    const [x1, y1] = punkte[i + 1];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

// Dekorativer Wochenverlauf in der KPI-Karte (die Zahl daneben ist die eigentliche Aussage).
export function Sparkline({ werte, farbe, id }: { werte: (number | null)[]; farbe: string; id: string }) {
  const reihe = werte.map((w) => w ?? 0);
  if (reihe.length === 0) return null;
  const max = Math.max(...reihe);
  const min = Math.min(...reihe);
  const spanne = max - min;
  const punkte: [number, number][] = reihe.map((w, i) => [
    reihe.length === 1 ? 0 : (i / (reihe.length - 1)) * B,
    spanne === 0 ? H * 0.72 : 6 + (1 - (w - min) / spanne) * (H - 12),
  ]);
  const linie = pfad(punkte);

  return (
    <svg viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="none" className="h-11 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={farbe} stopOpacity="0.28" />
          <stop offset="100%" stopColor={farbe} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linie} L${B},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={linie} fill="none" stroke={farbe} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}
