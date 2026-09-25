"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Download, MapPin, Play, Pause, Mic } from "lucide-react";
import type { Anhang, Standort } from "@/lib/chat/getChat";

export function groesseText(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function dauerText(sek: number) {
  const s = Math.max(0, Math.round(sek));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Wellenform aus der Audiodatei (Fallback: gleichmaessiges Muster, falls der Browser das Format nicht dekodiert)
function useWellenform(url: string | undefined, balken = 36): number[] {
  const [werte, setWerte] = useState<number[]>(() => Array.from({ length: balken }, (_, i) => 0.3 + 0.25 * Math.abs(Math.sin(i * 1.7))));
  useEffect(() => {
    if (!url) return;
    let aktiv = true;
    (async () => {
      try {
        const puffer = await (await fetch(url)).arrayBuffer();
        const ctx = new AudioContext();
        const audio = await ctx.decodeAudioData(puffer);
        ctx.close().catch(() => {});
        const daten = audio.getChannelData(0);
        const schritt = Math.max(1, Math.floor(daten.length / balken));
        const spitzen = Array.from({ length: balken }, (_, i) => {
          let max = 0;
          for (let j = i * schritt; j < Math.min(daten.length, (i + 1) * schritt); j += 16) max = Math.max(max, Math.abs(daten[j]));
          return max;
        });
        const hoechster = Math.max(...spitzen, 0.01);
        if (aktiv) setWerte(spitzen.map((s) => Math.max(0.12, s / hoechster)));
      } catch {
        // Fallback-Muster bleibt
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [url, balken]);
  return werte;
}

// Sprachnachricht: Wiedergabe, Wellenform (antippen = springen), Zeit und Abspielposition
function Sprachnachricht({ url, dauer, eigene }: { url: string | undefined; dauer: number | null; eigene: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [position, setPosition] = useState(0);
  const [laenge, setLaenge] = useState(dauer ?? 0);
  const welle = useWellenform(url);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const zeit = () => setPosition(a.currentTime);
    const ende = () => {
      setLaeuft(false);
      setPosition(0);
    };
    const meta = () => Number.isFinite(a.duration) && a.duration > 0 && setLaenge(a.duration);
    a.addEventListener("timeupdate", zeit);
    a.addEventListener("ended", ende);
    a.addEventListener("loadedmetadata", meta);
    return () => {
      a.removeEventListener("timeupdate", zeit);
      a.removeEventListener("ended", ende);
      a.removeEventListener("loadedmetadata", meta);
    };
  }, [url]);

  const anteil = laenge ? Math.min(1, position / laenge) : 0;

  return (
    <div className="flex min-w-[230px] items-center gap-2.5 py-1" onClick={(e) => e.stopPropagation()}>
      <audio ref={audio} src={url} preload="metadata" />
      <button
        type="button"
        disabled={!url}
        onClick={() => {
          const a = audio.current;
          if (!a) return;
          if (laeuft) a.pause();
          else a.play().catch(() => {});
          setLaeuft(!laeuft);
        }}
        aria-label={laeuft ? "Pause" : "Abspielen"}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${eigene ? "bg-brand-red" : "bg-brand-green"} disabled:opacity-50`}
      >
        {laeuft ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
      </button>
      <div className="flex flex-1 flex-col gap-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Abspielposition"
          aria-valuemin={0}
          aria-valuemax={Math.round(laenge)}
          aria-valuenow={Math.round(position)}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            if (audio.current && laenge) audio.current.currentTime = ((e.clientX - r.left) / r.width) * laenge;
          }}
          onKeyDown={(e) => {
            if (!audio.current) return;
            if (e.key === "ArrowRight") audio.current.currentTime = Math.min(laenge, position + 2);
            if (e.key === "ArrowLeft") audio.current.currentTime = Math.max(0, position - 2);
          }}
          className="flex h-7 cursor-pointer items-center gap-[2px]"
        >
          {welle.map((w, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full ${i / welle.length < anteil ? (eigene ? "bg-brand-red" : "bg-brand-green") : "bg-brand-ink-faint/45"}`}
              style={{ height: `${Math.round(w * 100)}%` }}
            />
          ))}
        </div>
        <span className="flex items-center gap-1 text-[11px] text-brand-ink-soft">
          <Mic size={11} /> {dauerText(laeuft || position ? position : laenge)}
        </span>
      </div>
    </div>
  );
}

export function AnhangAnsicht({ anhang, url, eigene }: { anhang: Anhang; url: string | undefined; eigene: boolean }) {
  if (anhang.art === "audio") return <Sprachnachricht url={url} dauer={anhang.dauer} eigene={eigene} />;
  if (anhang.art === "video") {
    return url ? (
      <video src={url} controls playsInline preload="metadata" className="-mx-1.5 mb-1 max-h-[340px] w-[calc(100%+0.75rem)] rounded-xl bg-black" onClick={(e) => e.stopPropagation()} />
    ) : (
      <span className="block h-40 w-60 animate-pulse rounded-xl bg-black/5" />
    );
  }
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      download={anhang.name}
      onClick={(e) => e.stopPropagation()}
      className="-mx-1 mb-1 flex min-w-[220px] items-center gap-3 rounded-xl bg-black/[0.04] px-3 py-2.5 hover:bg-black/[0.07]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-red">
        <FileText size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-brand-ink">{anhang.name}</span>
        <span className="block text-[11.5px] text-brand-ink-soft">
          {(anhang.name.split(".").pop() ?? "").toUpperCase()} {groesseText(anhang.groesse) && `· ${groesseText(anhang.groesse)}`}
        </span>
      </span>
      <Download size={17} className="shrink-0 text-brand-ink-soft" />
    </a>
  );
}

// Standort mit OpenStreetMap-Kachel (keine Drittanbieter-Einbettung, nur ein Kachelbild)
export function StandortAnsicht({ standort }: { standort: Standort }) {
  const zoom = 16;
  const n = 2 ** zoom;
  const xf = ((standort.lng + 180) / 360) * n;
  const breite = (standort.lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(breite) + 1 / Math.cos(breite)) / Math.PI) / 2) * n;
  const x = Math.floor(xf);
  const y = Math.floor(yf);
  const px = (xf - x) * 100;
  const py = (yf - y) * 100;
  const karte = `https://www.openstreetmap.org/?mlat=${standort.lat}&mlon=${standort.lng}#map=17/${standort.lat}/${standort.lng}`;
  const google = `https://www.google.com/maps/search/?api=1&query=${standort.lat},${standort.lng}`;

  return (
    <div className="-mx-1.5 mb-1 w-[240px] overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
      <a href={google} target="_blank" rel="noopener noreferrer" className="relative block h-[150px] overflow-hidden bg-brand-bg" aria-label="Standort in Karten öffnen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`}
          alt=""
          className="absolute h-[256px] w-[256px] max-w-none"
          style={{ left: `calc(50% - ${(px / 100) * 256}px)`, top: `calc(50% - ${(py / 100) * 256}px)` }}
        />
        <MapPin size={34} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full fill-brand-red text-white drop-shadow" />
      </a>
      <div className="flex items-center justify-between gap-2 bg-black/[0.04] px-2.5 py-1.5 text-[12px]">
        <a href={google} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-blue">
          📍 Standort öffnen
        </a>
        <a href={karte} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-ink-faint">
          © OpenStreetMap
        </a>
      </div>
    </div>
  );
}
