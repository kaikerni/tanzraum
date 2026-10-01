"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { stickerInfo, stickerUrl } from "@/lib/chat/sticker";
import type { Ebene, TextStil } from "@/lib/spotlights/typen";

// Story-Ebenen: eine gemeinsame Darstellung fuer Editor, Vorschau und Ansicht.
// Groessen sind relativ zur Buehnenbreite (Bezug 360 px), Positionen relativ (0–1 = Mittelpunkt der Ebene).

export const BEZUG = 360;

const TEXT_STIL: Record<TextStil, { label: string; klasse: string }> = {
  klassisch: { label: "Klassisch", klasse: "font-bold" },
  kraeftig: { label: "Kräftig", klasse: "font-black uppercase tracking-tight" },
  schrift: { label: "Schrift", klasse: "font-[family-name:var(--font-script)]" },
  neon: { label: "Neon", klasse: "font-extrabold" },
  schreibmaschine: { label: "Schreibmaschine", klasse: "font-mono font-semibold" },
};
export const TEXT_STILE = Object.entries(TEXT_STIL).map(([id, s]) => ({ id: id as TextStil, label: s.label }));

// #Hashtags und @Erwaehnungen im Text hervorheben
function TextMitMarken({ text }: { text: string }) {
  const teile = text.split(/([#@][A-Za-z0-9_.ÄÖÜäöüß]{2,40})/);
  return (
    <>
      {teile.map((t, i) =>
        /^[#@][A-Za-z0-9_.ÄÖÜäöüß]{2,40}$/.test(t) ? (
          <span key={i} className="text-[#f2d58c]">
            {t}
          </span>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </>
  );
}

// Inhalt einer Ebene in Grundgroesse (vor Skalierung/Drehung)
export function EbeneInhalt({ e, breite, hoehe, interaktiv = false }: { e: Ebene; breite: number; hoehe: number; interaktiv?: boolean }) {
  const u = breite / BEZUG;
  switch (e.typ) {
    case "text": {
      const neon = e.stil === "neon";
      return (
        <p
          className={`max-w-[85vw] whitespace-pre-wrap break-words leading-[1.15] ${TEXT_STIL[e.stil]?.klasse ?? "font-bold"}`}
          style={{
            fontSize: 28 * u,
            maxWidth: breite * 0.86,
            color: e.farbe,
            textAlign: e.ausrichtung === "links" ? "left" : e.ausrichtung === "rechts" ? "right" : "center",
            background: e.hinterlegt ? "rgba(15,18,25,0.62)" : undefined,
            padding: e.hinterlegt ? `${4 * u}px ${10 * u}px` : undefined,
            borderRadius: e.hinterlegt ? 10 * u : undefined,
            textShadow: neon ? `0 0 ${6 * u}px ${e.farbe}, 0 0 ${16 * u}px ${e.farbe}` : e.hinterlegt ? undefined : `0 ${1 * u}px ${4 * u}px rgba(0,0,0,0.55)`,
          }}
        >
          <TextMitMarken text={e.text} />
        </p>
      );
    }
    case "sticker":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stickerUrl(e.sticker)} alt={stickerInfo(e.sticker)?.name ?? "TanzRaum-Smiley"} draggable={false} style={{ width: 110 * u, height: 110 * u }} className="select-none object-contain drop-shadow-lg" />
      );
    case "emoji":
      return (
        <span className="select-none leading-none" style={{ fontSize: 64 * u }} role="img">
          {e.emoji}
        </span>
      );
    case "standort":
      return (
        <span
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white font-bold uppercase text-brand-red shadow-lg"
          style={{ fontSize: 16 * u, padding: `${6 * u}px ${12 * u}px` }}
        >
          <MapPin style={{ width: 17 * u, height: 17 * u }} /> {e.ort}
        </span>
      );
    case "erwaehnung": {
      const chip = (
        <span
          className="inline-flex whitespace-nowrap rounded-xl bg-white/95 font-bold text-brand-ink shadow-lg"
          style={{ fontSize: 17 * u, padding: `${6 * u}px ${12 * u}px` }}
        >
          {e.name}
        </span>
      );
      // In der Ansicht fuehrt die Erwaehnung zum Profil (die Datenbank hat sie beim Veroeffentlichen geprueft)
      return interaktiv ? (
        <Link href={`/dashboard/netzwerk/person/${e.user_id}`} className="pointer-events-auto">
          {chip}
        </Link>
      ) : (
        chip
      );
    }
    case "zeichnung":
      return (
        <svg width={breite} height={hoehe} viewBox="0 0 1 1" preserveAspectRatio="none" className="block" aria-hidden>
          {e.striche.map((s, i) => (
            <polyline
              key={i}
              points={s.punkte.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={s.farbe}
              strokeWidth={s.breite * breite}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      );
  }
}

export function ebenenStil(e: Ebene): React.CSSProperties {
  return {
    left: `${e.x * 100}%`,
    top: `${e.y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${e.drehung}deg) scale(${e.skala})`,
    transformOrigin: "center center",
  };
}

// Statische Darstellung (Ansicht/Vorschau). Erwaehnungen sind klickbar, alles andere laesst Tippen durch.
export function StoryEbenen({ ebenen, breite, hoehe, links = false }: { ebenen: Ebene[]; breite: number; hoehe: number; links?: boolean }) {
  if (breite <= 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {ebenen.map((e) => (
        <div key={e.id} className={`absolute ${links && e.typ === "erwaehnung" ? "z-30" : ""}`} style={ebenenStil(e)}>
          <EbeneInhalt e={e} breite={breite} hoehe={hoehe} interaktiv={links} />
        </div>
      ))}
    </div>
  );
}

// Groesse der Buehne beobachten (Ebenen skalieren mit der Breite)
export function useBuehnenGroesse(ref: React.RefObject<HTMLElement | null>) {
  const [groesse, setGroesse] = useState({ breite: 0, hoehe: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const messen = () => setGroesse({ breite: el.clientWidth, hoehe: el.clientHeight });
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return groesse;
}
