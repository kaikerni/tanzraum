"use client";

import { useState, useTransition } from "react";
import { Megaphone, Wrench, Sparkles, X, ExternalLink } from "lucide-react";
import { ankuendigungGelesen } from "@/app/dashboard/news/actions";
import type { Ankuendigung } from "@/lib/news/getNews";

const ART = {
  info: { icon: Megaphone, stil: "border-brand-blue/30 bg-brand-blue-wash", farbe: "text-brand-blue" },
  wartung: { icon: Wrench, stil: "border-brand-amber/40 bg-brand-amber-wash", farbe: "text-brand-ink" },
  neuheit: { icon: Sparkles, stil: "border-brand-gold/40 bg-brand-gold-wash", farbe: "text-brand-gold" },
} as const;

// TanzRaum-Ankuendigungen auf dem Dashboard; "Ausblenden" speichert den Lesestatus
export function AnkuendigungenLeiste({ liste, ausblendbar = true }: { liste: Ankuendigung[]; ausblendbar?: boolean }) {
  const [weg, setWeg] = useState<string[]>([]);
  const [, starte] = useTransition();
  const sichtbar = liste.filter((a) => !weg.includes(a.id));
  if (sichtbar.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {sichtbar.map((a) => {
        const { icon: Icon, stil, farbe } = ART[a.art] ?? ART.info;
        return (
          <div key={a.id} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${stil}`}>
            {a.bildUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.bildUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover shadow-sm sm:h-28 sm:w-28" loading="lazy" />
            ) : (
              <Icon size={20} className={`mt-0.5 shrink-0 ${farbe}`} />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold text-brand-ink">{a.titel}</div>
              {a.text && <p className="whitespace-pre-line text-[13.5px] text-brand-ink">{a.text}</p>}
              {a.linkUrl && (
                <a
                  href={a.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-ink px-3 text-[13px] font-semibold text-white hover:opacity-90"
                >
                  {a.linkText || "Mehr erfahren"} <ExternalLink size={14} />
                </a>
              )}
              <p className="mt-1 text-[11.5px] text-brand-ink-soft">TanzRaum</p>
            </div>
            {ausblendbar && (
              <button
                type="button"
                aria-label="Ausblenden"
                onClick={() => {
                  setWeg((w) => [...w, a.id]);
                  starte(async () => void (await ankuendigungGelesen([a.id])));
                }}
                className="rounded-lg p-1 text-brand-ink-soft hover:bg-white/60 hover:text-brand-ink"
              >
                <X size={16} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
