"use client";

import { useState, useTransition } from "react";
import { CalendarSync, Copy, Check, RefreshCw, ChevronDown } from "lucide-react";
import { aboLinksHolen, type AboLinks } from "@/app/dashboard/kalender/actions";

function AboZeile({ titel, text, url }: { titel: string; text: string; url: string }) {
  const [kopiert, setKopiert] = useState(false);
  const webcal = url.replace(/^https?:\/\//, "webcal://");
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(url);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      /* Zwischenablage nicht verfuegbar: Link bleibt markierbar */
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-bg p-3">
      <div>
        <div className="text-[13.5px] font-semibold text-brand-ink">{titel}</div>
        <div className="text-[12.5px] text-brand-ink-soft">{text}</div>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label={`Abo-Link: ${titel}`}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-brand-line bg-white px-2.5 text-[12px] text-brand-ink-soft"
        />
        <button
          type="button"
          onClick={kopieren}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg"
        >
          {kopiert ? <Check size={14} className="text-brand-green" /> : <Copy size={14} />}
          {kopiert ? "Kopiert" : "Kopieren"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={google}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-[12.5px] font-semibold text-brand-ink ring-1 ring-brand-line hover:bg-brand-bg"
        >
          Google Kalender
        </a>
        <a
          href={webcal}
          className="inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-[12.5px] font-semibold text-brand-ink ring-1 ring-brand-line hover:bg-brand-bg"
        >
          Apple Kalender / Outlook
        </a>
      </div>
    </div>
  );
}

export function KalenderAbo() {
  const [links, setLinks] = useState<AboLinks | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <details className="group rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <CalendarSync size={20} className="shrink-0 text-brand-ink" />
        <span className="flex-1">
          <span className="block text-[15px] font-bold text-brand-ink">Mit deinem Kalender synchronisieren</span>
          <span className="block text-[12.5px] text-brand-ink-soft">Google, Apple, Outlook und andere iCal-Kalender – nur lesend</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-brand-ink-soft transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-brand-line px-4 py-4 sm:px-5">
        {!links?.persoenlich ? (
          <>
            <p className="text-[13px] text-brand-ink-soft">
              Du bekommst einen persönlichen, geheimen Link. Wer ihn kennt, sieht deine Termine – gib ihn also nicht weiter.
              Änderungen in TanzRaum erscheinen automatisch in deinem Kalender (je nach App mit etwas Verzögerung).
            </p>
            <div>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => starte(async () => setLinks(await aboLinksHolen(false)))}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-navy px-4 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                <CalendarSync size={16} /> {laeuft ? "Einen Moment …" : "Abo-Link anzeigen"}
              </button>
            </div>
          </>
        ) : (
          <>
            <AboZeile
              titel="Mein TanzRaum-Kalender"
              text="Deine Trainings (ohne abgemeldete), Vereinstermine und privaten Termine."
              url={links.persoenlich}
            />
            {links.turniere && (
              <AboZeile titel="Alle TanzRaum-Turniere" text="Der zentrale Turnierkalender als eigener Kalender." url={links.turniere} />
            )}
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-brand-ink-soft">
              <button
                type="button"
                disabled={laeuft}
                onClick={() => {
                  if (confirm("Neuen Link erzeugen? Der alte Link funktioniert danach nicht mehr – bestehende Abos musst du neu einrichten.")) {
                    starte(async () => setLinks(await aboLinksHolen(true)));
                  }
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line px-3 font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-60"
              >
                <RefreshCw size={14} /> Link zurücksetzen
              </button>
              Falls jemand anderes deinen Link kennt.
            </div>
          </>
        )}
        {links?.error && <p className="form-error">{links.error}</p>}
      </div>
    </details>
  );
}
