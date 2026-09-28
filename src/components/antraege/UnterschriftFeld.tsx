"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

// Unterschrift mit Finger, Maus oder Stift. Ergebnis: PNG (transparent) als Daten-URL, feste Groesse 600x160.
const B = 600;
const H = 160;

export function UnterschriftFeld({ label, wert, onChange }: { label: string; wert: string | undefined; onChange: (bild: string | undefined) => void }) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const letzter = useRef<{ x: number; y: number } | null>(null);
  const [leer, setLeer] = useState(!wert);

  // Vorhandene Unterschrift anzeigen (z. B. nach erneutem Rendern)
  useEffect(() => {
    const c = leinwand.current;
    if (!c || !wert) return;
    const ctx = c.getContext("2d");
    const bild = new Image();
    bild.onload = () => {
      ctx?.clearRect(0, 0, B, H);
      ctx?.drawImage(bild, 0, 0, B, H);
    };
    bild.src = wert;
    // nur beim ersten Anzeigen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function punkt(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * B, y: ((e.clientY - r.top) / r.height) * H };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    letzter.current = punkt(e);
  }

  function bewegen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    const ctx = leinwand.current?.getContext("2d");
    const p = punkt(e);
    if (!ctx || !letzter.current) return;
    ctx.strokeStyle = "#16203a";
    ctx.lineWidth = e.pointerType === "pen" ? 2.2 + (e.pressure || 0.5) * 2 : 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(letzter.current.x, letzter.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    letzter.current = p;
    setLeer(false);
  }

  function ende() {
    if (!zeichnet.current) return;
    zeichnet.current = false;
    letzter.current = null;
    if (leinwand.current) onChange(leinwand.current.toDataURL("image/png"));
  }

  function loeschen() {
    leinwand.current?.getContext("2d")?.clearRect(0, 0, B, H);
    setLeer(true);
    onChange(undefined);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-brand-ink-soft">{label}</span>
        <button type="button" onClick={loeschen} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-ink-soft hover:text-brand-red">
          <Eraser size={13} /> Löschen
        </button>
      </div>
      <div className="relative">
        <canvas
          ref={leinwand}
          width={B}
          height={H}
          onPointerDown={start}
          onPointerMove={bewegen}
          onPointerUp={ende}
          onPointerCancel={ende}
          onPointerLeave={ende}
          aria-label={`Unterschriftsfeld: ${label}`}
          className="block aspect-[600/160] w-full touch-none rounded-xl border-2 border-dashed border-brand-line bg-white"
        />
        {leer && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-brand-ink-faint">
            Hier mit Finger, Maus oder Stift unterschreiben
          </span>
        )}
        <span className="pointer-events-none absolute bottom-5 left-4 right-4 border-b border-brand-ink-faint/40" />
      </div>
    </div>
  );
}
