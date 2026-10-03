"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const ZONE = "Europe/Berlin";
const datumText = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONE });
const zeitText = (d: Date) => `${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })} Uhr`;

// Datum und Uhrzeit fuer alle Dashboards; aktualisiert sich zum Minutenwechsel (ein Timer, keine Serveranfragen)
export function DatumUhrzeit({ variante = "block", className = "" }: { variante?: "block" | "zeile"; className?: string }) {
  const [jetzt, setJetzt] = useState(() => new Date());

  useEffect(() => {
    let takt: number | undefined;
    const bisMinute = 60_000 - (Date.now() % 60_000) + 50;
    const start = window.setTimeout(() => {
      setJetzt(new Date());
      takt = window.setInterval(() => setJetzt(new Date()), 60_000);
    }, bisMinute);
    // nach Ruhezustand/Tab-Wechsel sofort richtig anzeigen
    const sichtbar = () => document.visibilityState === "visible" && setJetzt(new Date());
    document.addEventListener("visibilitychange", sichtbar);
    return () => {
      window.clearTimeout(start);
      if (takt) window.clearInterval(takt);
      document.removeEventListener("visibilitychange", sichtbar);
    };
  }, []);

  if (variante === "zeile") {
    return (
      <p className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-brand-ink-soft ${className}`}>
        <Clock size={14} className="shrink-0" aria-hidden />
        <span suppressHydrationWarning>{datumText(jetzt)}</span>
        <span aria-hidden>·</span>
        <time suppressHydrationWarning dateTime={jetzt.toISOString()} className="font-semibold tabular-nums text-brand-ink">
          {zeitText(jetzt)}
        </time>
      </p>
    );
  }
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <span suppressHydrationWarning className="text-[13px] font-medium text-brand-ink-soft">
        {datumText(jetzt)}
      </span>
      <time suppressHydrationWarning dateTime={jetzt.toISOString()} className="text-[22px] font-extrabold leading-tight tabular-nums text-brand-ink">
        {zeitText(jetzt)}
      </time>
    </div>
  );
}
