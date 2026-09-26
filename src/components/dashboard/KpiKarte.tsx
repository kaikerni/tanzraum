import type { LucideIcon } from "lucide-react";
import { Sparkline } from "./Sparkline";

const FARBEN = {
  green: { kreis: "bg-brand-green", linie: "#1f9d55" },
  red: { kreis: "bg-brand-red", linie: "#e11d2e" },
  amber: { kreis: "bg-brand-amber", linie: "#f2a93b" },
  gold: { kreis: "bg-brand-gold", linie: "#c9921f" },
  blue: { kreis: "bg-brand-blue", linie: "#1f6feb" },
  navy: { kreis: "bg-brand-navy", linie: "#1f9d55" },
} as const;

export type KpiFarbe = keyof typeof FARBEN;

export function KpiKarte({
  id,
  icon: Icon,
  farbe,
  wert,
  label,
  zusatz,
  zusatzTon = "neutral",
  verlauf,
}: {
  id: string;
  icon: LucideIcon;
  farbe: KpiFarbe;
  wert: number | string;
  label: string;
  zusatz?: string;
  zusatzTon?: "neutral" | "positiv" | "negativ";
  verlauf: (number | null)[];
}) {
  const f = FARBEN[farbe];
  const tonKlasse =
    zusatzTon === "positiv"
      ? "text-brand-green"
      : zusatzTon === "negativ"
        ? "text-brand-red"
        : "text-brand-ink-soft";

  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)]">
      <div className="flex flex-col items-start gap-2.5 px-3.5 pt-4 sm:flex-row sm:gap-3 2xl:gap-2.5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${f.kreis}`}
        >
          <Icon size={21} strokeWidth={2} />
        </span>
        <div className="min-w-0 max-w-full hyphens-auto break-words">
          <div className="text-[24px] font-bold leading-none tracking-tight text-brand-ink sm:text-[26px]">{wert}</div>
          <div className="mt-1.5 text-[13px] font-medium leading-snug text-brand-ink">{label}</div>
          {zusatz && (
            <div className={`mt-1 line-clamp-2 break-words text-[12px] font-medium leading-snug ${tonKlasse}`} title={zusatz}>
              {zusatz}
            </div>
          )}
        </div>
      </div>
      <div className="mt-auto pt-2">
        <Sparkline werte={verlauf} farbe={f.linie} id={`spark-${id}`} />
      </div>
    </div>
  );
}
