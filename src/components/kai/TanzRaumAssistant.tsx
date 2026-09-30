"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpLeft, CheckCircle2, HelpCircle, Info, Sparkles, Wrench, X, type LucideIcon } from "lucide-react";
import { KaiFigur } from "@/components/kai/KaiFigur";
import { POSE_FUER_VARIANTE } from "@/lib/kai/posen";
import { kaiLesen, kaiSchreiben } from "@/lib/kai/speicher";
import { KAI_FUNKTIONEN } from "@/lib/kai/steuerung";
import type { KaiPose, KaiVariante } from "@/lib/kai/typen";

export type { KaiVariante } from "@/lib/kai/typen";

// Kai als Sprechblase im Seitenfluss – fuer Hinweise direkt auf einer Seite.
// Kai ist KEINE KI: Er zeigt nur die Texte, die die Seite vorgibt, liest und aendert keine Daten, verschickt nichts
// und trifft keine Entscheidungen. Aktionen (Links/Knoepfe) gibt die Seite selbst mit.
// Kai steht nie ueber Inhalten: Figur und Blase haben jeweils eigenen Platz, lange Texte brechen um.

const VARIANTE: Record<KaiVariante, { label: string; icon: LucideIcon; akzent: string; chip: string }> = {
  welcome: { label: "Willkommen", icon: Sparkles, akzent: "bg-brand-gold", chip: "bg-brand-gold-wash text-[#8a5a00]" },
  help: { label: "Hilfe", icon: HelpCircle, akzent: "bg-brand-red", chip: "bg-brand-red-wash text-brand-red" },
  info: { label: "Gut zu wissen", icon: Info, akzent: "bg-brand-ink", chip: "bg-brand-bg text-brand-ink" },
  success: { label: "Geschafft", icon: CheckCircle2, akzent: "bg-brand-gold", chip: "bg-brand-gold-wash text-[#8a5a00]" },
  warning: { label: "Achtung", icon: AlertTriangle, akzent: "bg-brand-red", chip: "bg-brand-red-wash text-brand-red" },
  point: { label: "Schau mal", icon: ArrowUpLeft, akzent: "bg-brand-red", chip: "bg-brand-red-wash text-brand-red" },
  setup: { label: "Einrichtung", icon: Wrench, akzent: "bg-brand-gold", chip: "bg-brand-gold-wash text-[#8a5a00]" },
};

export function TanzRaumAssistant({
  variant = "info",
  message,
  title,
  children,
  actions,
  size = "normal",
  pose,
  dismissKey,
  animated = KAI_FUNKTIONEN.animationen,
  className = "",
}: {
  variant?: KaiVariante;
  /** Hauptaussage in der Sprechblase */
  message: React.ReactNode;
  /** Optionale Ueberschrift ueber der Aussage */
  title?: string;
  /** Weitere Erklaerung (z. B. Liste der naechsten Schritte) */
  children?: React.ReactNode;
  /** Links/Knoepfe der Seite – Kai selbst loest nichts aus */
  actions?: React.ReactNode;
  /** kompakt: Porträt + Blase (fuer Hinweise in Karten); normal: Figur neben der Blase; gross: groessere Figur */
  size?: "kompakt" | "normal" | "gross";
  /** Bild/Pose (Standard je Variante, siehe src/lib/kai/posen.ts) */
  pose?: KaiPose;
  /** Wenn gesetzt, kann der Hinweis ausgeblendet werden (gemerkt nur auf diesem Geraet) */
  dismissKey?: string;
  /** Dezentes Einblenden (entfaellt bei „Bewegung reduzieren“) */
  animated?: boolean;
  className?: string;
}) {
  const v = VARIANTE[variant];
  const Icon = v.icon;
  const bildPose = pose ?? POSE_FUER_VARIANTE[variant];
  // Ausblendbare Hinweise erst nach dem Laden zeigen, damit ausgeblendete nicht kurz aufblitzen
  const [sichtbar, setSichtbar] = useState(!dismissKey);
  useEffect(() => {
    if (dismissKey) setSichtbar(!kaiLesen().ausgeblendet.includes(dismissKey));
  }, [dismissKey]);
  if (!sichtbar) return null;

  function schliessen() {
    if (!dismissKey) return;
    kaiSchreiben((s) => ({ ...s, ausgeblendet: [...new Set([...s.ausgeblendet, dismissKey])] }));
    setSichtbar(false);
  }

  const einblenden = animated ? "motion-safe:animate-[kai-rein_420ms_ease-out_both]" : "";
  const kopf = (
    <div className="flex items-center justify-between gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${v.chip}`}>
        <Icon size={13} aria-hidden /> Kai · {v.label}
      </span>
      {dismissKey && (
        <button
          type="button"
          onClick={schliessen}
          className="-m-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink"
          aria-label="Hinweis ausblenden"
          title="Ausblenden"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
  const inhalt = (
    <>
      {title && <p className="break-words text-[15.5px] font-extrabold leading-snug text-brand-ink [overflow-wrap:anywhere]">{title}</p>}
      <div className="break-words text-[14px] leading-relaxed text-brand-ink [overflow-wrap:anywhere]">{message}</div>
      {children && <div className="break-words text-[13.5px] leading-relaxed text-brand-ink-soft">{children}</div>}
      {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
    </>
  );

  if (size === "kompakt") {
    return (
      <aside aria-label={`Kai: ${v.label}`} className={`flex items-start gap-3 ${einblenden} ${className}`}>
        <KaiFigur form="portrait" pose={bildPose} className="mt-0.5 h-12 w-12" sizes="48px" />
        <div className="relative min-w-0 flex-1 rounded-2xl rounded-tl-md border border-brand-line bg-white px-3.5 py-2.5 shadow-[var(--shadow)]">
          <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${v.akzent}`} aria-hidden />
          <div className="flex flex-col gap-1.5">
            {kopf}
            {inhalt}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label={`Kai: ${v.label}`} className={`flex items-end gap-2 sm:gap-3 ${einblenden} ${className}`}>
      <div className="relative min-w-0 flex-1 rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-[var(--shadow)] sm:mb-6 sm:rounded-br-md">
        <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${v.akzent}`} aria-hidden />
        {/* Sprechblasen-Spitze zu Kai (nur neben der Figur) */}
        <span className="absolute -right-[7px] bottom-5 hidden h-3.5 w-3.5 rotate-45 border-r border-t border-brand-line bg-white sm:block" aria-hidden />
        <div className="flex gap-3">
          {/* Auf dem Handy: Porträt statt ganzer Figur, damit Kai keinen Platz wegnimmt */}
          <KaiFigur form="portrait" pose={bildPose} alt="" className="mt-0.5 h-11 w-11 sm:hidden" sizes="44px" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {kopf}
            {inhalt}
          </div>
        </div>
      </div>
      <KaiFigur
        pose={bildPose}
        className={`hidden sm:block ${size === "gross" ? "sm:h-64 sm:w-[171px]" : "sm:h-48 sm:w-32"}`}
        sizes={size === "gross" ? "171px" : "128px"}
      />
    </aside>
  );
}
