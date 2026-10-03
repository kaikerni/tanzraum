"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

// Grosse Bildergalerie der Detailseite (Pfeile, Vorschaubilder, Wischen per Scroll-Snap auf dem Handy)
export function Galerie({ bilder, titel }: { bilder: string[]; titel: string }) {
  const [i, setI] = useState(0);
  if (bilder.length === 0) {
    return (
      <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-l)] bg-brand-bg text-brand-ink-faint sm:aspect-[4/3]">
        <ImageOff size={36} />
        <span className="text-[13px]">Keine Bilder</span>
      </div>
    );
  }
  const zu = (n: number) => setI((n + bilder.length) % bilder.length);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-[var(--radius-l)] bg-brand-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bilder[i]} alt={`${titel} – Bild ${i + 1} von ${bilder.length}`} className="aspect-[4/5] w-full object-contain sm:aspect-[4/3]" />
        {bilder.length > 1 && (
          <>
            <button type="button" onClick={() => zu(i - 1)} aria-label="Vorheriges Bild" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-ink shadow-md hover:bg-white">
              <ChevronLeft size={22} />
            </button>
            <button type="button" onClick={() => zu(i + 1)} aria-label="Nächstes Bild" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-ink shadow-md hover:bg-white">
              <ChevronRight size={22} />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold text-white">
              {i + 1} / {bilder.length}
            </span>
          </>
        )}
      </div>
      {bilder.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {bilder.map((b, n) => (
            <button
              key={b}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Bild ${n + 1}`}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${n === i ? "border-brand-red" : "border-transparent opacity-80 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
