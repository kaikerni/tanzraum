"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Dialog im TanzRaum-Stil: auf dem Handy als Blatt von unten, ab Tablet mittig (wie der Abmelde-Dialog)
export function Dialog({
  titel,
  untertitel,
  onSchliessen,
  children,
  fuss,
  breit = false,
}: {
  titel: string;
  untertitel?: string;
  onSchliessen: () => void;
  children: ReactNode;
  fuss?: ReactNode;
  breit?: boolean;
}) {
  const [bereit, setBereit] = useState(false);
  useEffect(() => setBereit(true), []);
  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
    }
    document.addEventListener("keydown", taste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", taste);
      document.body.style.overflow = vorher;
    };
  }, [onSchliessen]);

  if (!bereit) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="dialog-titel">
      <button type="button" aria-label="Schließen" className="absolute inset-0 bg-brand-navy/45" onClick={onSchliessen} />
      <div
        className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-[0_-12px_40px_-12px_rgba(27,33,48,0.35)] md:inset-auto md:left-1/2 md:top-1/2 md:max-w-[calc(100vw-32px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl ${
          breit ? "md:w-[640px]" : "md:w-[520px]"
        }`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-brand-line md:hidden" />
        <div className="flex shrink-0 items-start gap-2 px-4 pb-2 pt-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="dialog-titel" className="text-[18px] font-extrabold leading-snug text-brand-ink [overflow-wrap:anywhere]">
              {titel}
            </h2>
            {untertitel && <p className="mt-0.5 text-[13px] text-brand-ink-soft [overflow-wrap:anywhere]">{untertitel}</p>}
          </div>
          <button type="button" onClick={onSchliessen} aria-label="Schließen" className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-brand-bg">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">{children}</div>
        {fuss && <div className="shrink-0 border-t border-brand-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">{fuss}</div>}
      </div>
    </div>,
    document.body,
  );
}
