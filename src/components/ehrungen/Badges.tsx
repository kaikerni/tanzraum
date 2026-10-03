import { HERKUNFT, PRUEFSTATUS, STATUS, TYP, type Herkunft, type Pruefstatus, type Status, type Typ } from "@/lib/ehrungen/typen";

const BADGE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold";

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={`${BADGE} ${s.klasse}`}>
      {s.zeichen} {s.label}
    </span>
  );
}

export function TypBadge({ typ }: { typ: Typ }) {
  return (
    <span className={`${BADGE} ${typ === "verband" ? "bg-brand-navy text-white" : "bg-brand-gold-wash text-[#8a5a00]"}`}>
      {TYP[typ].zeichen} {TYP[typ].kurz}
    </span>
  );
}

export function HerkunftBadge({ herkunft }: { herkunft: Herkunft }) {
  return (
    <span className={`${BADGE} bg-brand-bg text-brand-ink-soft`}>
      {HERKUNFT[herkunft].zeichen} {HERKUNFT[herkunft].label}
    </span>
  );
}

export function PruefBadge({ status }: { status: Pruefstatus }) {
  const p = PRUEFSTATUS[status];
  return (
    <span title={p.text} className={`${BADGE} ${status === "nicht_geprueft" ? "bg-brand-amber-wash text-[#8a5a00]" : status === "geprueft" ? "bg-brand-blue-wash text-brand-blue" : "bg-brand-green-wash text-brand-green"}`}>
      {p.zeichen} {p.label}
    </span>
  );
}
