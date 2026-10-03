"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Trash2, Send, Lock, ChevronLeft, ChevronUp } from "lucide-react";

function dauerText(sek: number) {
  return `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, "0")}`;
}

const ABBRUCH_PX = 90;
const SPERRE_PX = 70;

// Sprachnachricht: Mikrofon gedrueckt halten = aufnehmen, loslassen = senden,
// nach links wischen = abbrechen, nach oben wischen = sperren (freihaendig weiter).
// Kurzes Antippen startet direkt die gesperrte Aufnahme (praktisch am Computer).
export function Sprachaufnahme({
  onFertig,
  onFehler,
  onAktiv,
  deaktiviert,
}: {
  onFertig: (blob: Blob, dauer: number) => void;
  onFehler: (text: string) => void;
  onAktiv?: (aktiv: boolean) => void;
  deaktiviert?: boolean;
}) {
  const [zustand, setZustand] = useState<"aus" | "halten" | "gesperrt">("aus");
  const [sekunden, setSekunden] = useState(0);
  const [wisch, setWisch] = useState({ x: 0, y: 0 });
  const [pegel, setPegel] = useState<number[]>(Array(28).fill(0.1));
  const rekorder = useRef<MediaRecorder | null>(null);
  const teile = useRef<Blob[]>([]);
  const start = useRef(0);
  const uhr = useRef<ReturnType<typeof setInterval> | null>(null);
  const verwerfen = useRef(false);
  const druckStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const zustandRef = useRef(zustand);
  const analyse = useRef<{ ctx: AudioContext; an: AnalyserNode; raf: number } | null>(null);
  zustandRef.current = zustand;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => stoppen(true), []);

  async function starten(modus: "halten" | "gesperrt") {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onFehler("Sprachnachrichten werden von diesem Browser nicht unterstützt.");
      return;
    }
    setZustand(modus);
    onAktiv?.(true);
    setSekunden(0);
    try {
      const strom = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Schon wieder losgelassen/abgebrochen, bevor das Mikrofon bereit war
      if (zustandRef.current === "aus") {
        strom.getTracks().forEach((t) => t.stop());
        return;
      }
      const typ = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(strom, typ ? { mimeType: typ } : undefined);
      teile.current = [];
      verwerfen.current = false;
      r.ondataavailable = (e) => e.data.size > 0 && teile.current.push(e.data);
      r.onstop = () => {
        strom.getTracks().forEach((t) => t.stop());
        const dauer = Math.round((Date.now() - start.current) / 1000);
        if (!verwerfen.current && dauer >= 1) onFertig(new Blob(teile.current, { type: (r.mimeType || "audio/webm").split(";")[0] }), dauer);
      };
      rekorder.current = r;
      start.current = Date.now();
      r.start(250);
      uhr.current = setInterval(() => {
        const s = Math.round((Date.now() - start.current) / 1000);
        setSekunden(s);
        if (s >= 300) stoppen(false); // max. 5 Minuten
      }, 250);
      // Live-Pegel als kleine Wellenform
      try {
        const ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        ctx.createMediaStreamSource(strom).connect(an);
        const daten = new Uint8Array(an.frequencyBinCount);
        const schleife = () => {
          an.getByteTimeDomainData(daten);
          let max = 0;
          for (const v of daten) max = Math.max(max, Math.abs(v - 128) / 128);
          setPegel((p) => [...p.slice(1), Math.max(0.08, Math.min(1, max * 2.2))]);
          if (analyse.current) analyse.current.raf = requestAnimationFrame(schleife);
        };
        analyse.current = { ctx, an, raf: requestAnimationFrame(schleife) };
      } catch {
        // ohne Pegelanzeige
      }
    } catch {
      setZustand("aus");
      onAktiv?.(false);
      onFehler("Kein Zugriff auf das Mikrofon. Bitte in den Browser-Einstellungen erlauben.");
    }
  }

  function stoppen(weg: boolean) {
    verwerfen.current = weg;
    if (uhr.current) clearInterval(uhr.current);
    if (analyse.current) {
      cancelAnimationFrame(analyse.current.raf);
      analyse.current.ctx.close().catch(() => {});
      analyse.current = null;
    }
    if (rekorder.current && rekorder.current.state !== "inactive") rekorder.current.stop();
    rekorder.current = null;
    setZustand("aus");
    setWisch({ x: 0, y: 0 });
    setPegel(Array(28).fill(0.1));
    onAktiv?.(false);
  }

  const knopf = (
    <button
      type="button"
      disabled={deaktiviert}
      aria-label="Sprachnachricht: gedrückt halten zum Aufnehmen, antippen für freihändige Aufnahme"
      title="Gedrückt halten zum Aufnehmen"
      onPointerDown={(e) => {
        if (deaktiviert || zustand !== "aus") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        druckStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
        starten("halten");
      }}
      onPointerMove={(e) => {
        if (zustandRef.current !== "halten" || !druckStart.current) return;
        const x = Math.min(0, e.clientX - druckStart.current.x);
        const y = Math.min(0, e.clientY - druckStart.current.y);
        setWisch({ x, y });
        if (-x > ABBRUCH_PX) stoppen(true);
        else if (-y > SPERRE_PX) {
          setZustand("gesperrt");
          setWisch({ x: 0, y: 0 });
        }
      }}
      onPointerUp={() => {
        const d = druckStart.current;
        druckStart.current = null;
        if (zustandRef.current !== "halten") return;
        // kurzes Antippen: freihaendig weiter aufnehmen
        if (d && Date.now() - d.t < 350) setZustand("gesperrt");
        else stoppen(false);
      }}
      onPointerCancel={() => zustandRef.current === "halten" && stoppen(true)}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex h-11 w-11 shrink-0 touch-none select-none items-center justify-center rounded-full bg-brand-red text-white transition-transform hover:bg-brand-red-deep disabled:opacity-60 ${
        zustand === "halten" ? "scale-125 shadow-lg" : ""
      }`}
      style={zustand === "halten" ? { transform: `translate(${wisch.x}px, ${wisch.y}px) scale(1.25)` } : undefined}
    >
      <Mic size={20} />
    </button>
  );

  if (zustand === "aus") return knopf;

  const welle = (
    <span className="flex h-6 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
      {pegel.map((p, i) => (
        <span key={i} className="w-[3px] shrink-0 rounded-full bg-brand-red/70" style={{ height: `${Math.round(p * 100)}%` }} />
      ))}
    </span>
  );

  if (zustand === "halten") {
    return (
      <div className="relative flex flex-1 items-center gap-2" role="status" aria-live="polite">
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-3xl bg-brand-bg px-3 text-[13.5px] text-brand-ink">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-brand-red" />
          <span className="w-10 shrink-0 tabular-nums">{dauerText(sekunden)}</span>
          {welle}
          <span className="hidden shrink-0 items-center gap-0.5 text-[12px] text-brand-ink-soft sm:inline-flex" style={{ opacity: 1 + wisch.x / ABBRUCH_PX }}>
            <ChevronLeft size={14} /> Abbrechen
          </span>
        </div>
        <span className="absolute -top-14 right-1 flex flex-col items-center rounded-full bg-white px-2 py-1.5 text-brand-ink-soft shadow-md">
          <Lock size={14} />
          <ChevronUp size={14} />
        </span>
        {knopf}
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2" role="status" aria-live="polite">
      <button type="button" onClick={() => stoppen(true)} aria-label="Aufnahme verwerfen" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-red hover:bg-brand-red-wash">
        <Trash2 size={19} />
      </button>
      <div className="flex min-h-11 flex-1 items-center gap-2 rounded-3xl bg-brand-bg px-3 text-[13.5px] text-brand-ink">
        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-brand-red" />
        <span className="w-10 shrink-0 tabular-nums">{dauerText(sekunden)}</span>
        {welle}
        <Lock size={14} className="shrink-0 text-brand-ink-faint" aria-label="gesperrt" />
      </div>
      <button type="button" onClick={() => stoppen(false)} aria-label="Sprachnachricht senden" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red text-white hover:bg-brand-red-deep">
        <Send size={19} />
      </button>
    </div>
  );
}
