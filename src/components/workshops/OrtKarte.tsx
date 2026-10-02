"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, MapPin, Map as MapIcon } from "lucide-react";
import { MERKEN, STIL, googleMapsLaden, htmlMarker } from "@/components/netzwerk/NetzwerkMap";

// Kompakte Karte fuer einen Ort (Workshops): Google Maps erst nach Klick auf „Karte laden“ (wie die Netzwerk-Map,
// eine dort gemerkte Zustimmung gilt auch hier). Ohne Koordinaten oder Schluessel: Link zu Google Maps.
export function OrtKarte({ lat, lng, titel, suche, schluessel }: { lat: number | null; lng: number | null; titel: string; suche: string; schluessel: string }) {
  const behaelter = useRef<HTMLDivElement>(null);
  const [erlaubt, setErlaubt] = useState(false);
  const [fehler, setFehler] = useState(false);
  const extern = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(suche)}`;
  const moeglich = lat !== null && lng !== null && !!schluessel;

  useEffect(() => {
    try {
      if (localStorage.getItem(MERKEN) === "ja") setErlaubt(true);
    } catch {
      // ohne Speicher: jedes Mal fragen
    }
  }, []);

  useEffect(() => {
    if (!erlaubt || !moeglich || !behaelter.current) return;
    let abbruch = false;
    googleMapsLaden(schluessel)
      .then((bib) => {
        if (abbruch || !behaelter.current) return;
        const pos = { lat: lat!, lng: lng! };
        const m = new bib.Map(behaelter.current, { center: pos, zoom: 13, styles: STIL, disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative" });
        const el = document.createElement("div");
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center"><span style="background:#e11d2e;color:#fff;border-radius:12px;padding:4px 8px;font:700 12px system-ui;box-shadow:0 4px 12px rgba(0,0,0,.25);white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis">🎓 ${titel.replace(/[<>&"]/g, "")}</span><span style="width:2px;height:10px;background:#e11d2e"></span></div>`;
        htmlMarker(bib, pos, el, true).setMap(m);
      })
      .catch(() => setFehler(true));
    return () => {
      abbruch = true;
    };
  }, [erlaubt, moeglich, schluessel, lat, lng, titel]);

  if (!moeglich) {
    return (
      <a href={extern} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-line px-3 text-[13.5px] font-semibold hover:bg-brand-bg">
        <MapPin size={16} className="text-brand-red" /> In Google Maps öffnen <ExternalLink size={14} />
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[240px] overflow-hidden rounded-2xl border border-brand-line bg-[#faf7f4] sm:h-[300px]">
        <div ref={behaelter} className="absolute inset-0" />
        {!erlaubt && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <MapIcon size={24} className="text-brand-red" />
            <p className="max-w-sm text-[12.5px] text-brand-ink-soft">
              Die Karte kommt von Google Maps. Beim Laden überträgt dein Browser Daten (u. a. deine IP-Adresse) an Google –{" "}
              <Link href="/datenschutz" className="font-semibold text-brand-red">
                Datenschutz
              </Link>
              .
            </p>
            <button
              type="button"
              onClick={() => setErlaubt(true)}
              className="btn-primary mt-0 min-h-10 px-5 text-[14px]"
            >
              Karte laden
            </button>
          </div>
        )}
        {fehler && <div className="absolute inset-0 flex items-center justify-center bg-[#faf7f4] p-4 text-[13px] text-brand-ink-soft">Die Karte ist gerade nicht verfügbar.</div>}
      </div>
      <a href={extern} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-red">
        In Google Maps öffnen <ExternalLink size={13} />
      </a>
    </div>
  );
}
