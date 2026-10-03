"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { merkenUmschalten } from "@/app/dashboard/turniere/actions";

export function MerkenKnopf({ turnierId, gemerkt, mitText = false }: { turnierId: string; gemerkt: boolean; mitText?: boolean }) {
  const [an, setAn] = useState(gemerkt);
  const [laeuft, starte] = useTransition();

  return (
    <button
      type="button"
      disabled={laeuft}
      aria-pressed={an}
      aria-label={an ? "Von der Merkliste entfernen" : "Auf die Merkliste setzen"}
      title={an ? "Gemerkt" : "Merken"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const neu = !an;
        setAn(neu);
        starte(async () => {
          const r = await merkenUmschalten(turnierId, neu);
          if (r.error) setAn(!neu);
        });
      }}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
        an ? "border-brand-gold bg-brand-gold-wash text-brand-gold" : "border-brand-line bg-white text-brand-ink-soft hover:text-brand-ink"
      }`}
    >
      <Star size={16} className={an ? "fill-current" : ""} />
      {mitText && (an ? "Gemerkt" : "Merken")}
    </button>
  );
}
