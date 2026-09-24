"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Trash2, Send } from "lucide-react";

function dauerText(sek: number) {
  return `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, "0")}`;
}

// Sprachnachricht aufnehmen (MediaRecorder). Start per Mikrofon-Knopf, dann Verwerfen oder Senden.
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
  const [aktiv, setAktiv] = useState(false);
  const [sekunden, setSekunden] = useState(0);
  const rekorder = useRef<MediaRecorder | null>(null);
  const teile = useRef<Blob[]>([]);
  const start = useRef(0);
  const uhr = useRef<ReturnType<typeof setInterval> | null>(null);
  const verwerfen = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => stoppen(true), []);

  async function starten() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onFehler("Sprachnachrichten werden von diesem Browser nicht unterstützt.");
      return;
    }
    try {
      const strom = await navigator.mediaDevices.getUserMedia({ audio: true });
      const typ = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(strom, typ ? { mimeType: typ } : undefined);
      teile.current = [];
      verwerfen.current = false;
      r.ondataavailable = (e) => e.data.size > 0 && teile.current.push(e.data);
      r.onstop = () => {
        strom.getTracks().forEach((t) => t.stop());
        const dauer = Math.round((Date.now() - start.current) / 1000);
        if (!verwerfen.current && dauer >= 1) {
          onFertig(new Blob(teile.current, { type: (r.mimeType || "audio/webm").split(";")[0] }), dauer);
        }
      };
      rekorder.current = r;
      start.current = Date.now();
      r.start(250);
      setAktiv(true);
      onAktiv?.(true);
      setSekunden(0);
      uhr.current = setInterval(() => {
        const s = Math.round((Date.now() - start.current) / 1000);
        setSekunden(s);
        if (s >= 300) stoppen(false); // max. 5 Minuten
      }, 250);
    } catch {
      onFehler("Kein Zugriff auf das Mikrofon. Bitte in den Browser-Einstellungen erlauben.");
    }
  }

  function stoppen(weg: boolean) {
    verwerfen.current = weg;
    if (uhr.current) clearInterval(uhr.current);
    if (rekorder.current && rekorder.current.state !== "inactive") rekorder.current.stop();
    rekorder.current = null;
    setAktiv(false);
    onAktiv?.(false);
  }

  if (!aktiv) {
    return (
      <button
        type="button"
        disabled={deaktiviert}
        onClick={starten}
        aria-label="Sprachnachricht aufnehmen"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red text-white hover:bg-brand-red-deep disabled:opacity-60"
      >
        <Mic size={20} />
      </button>
    );
  }

  return (
    <div className="flex flex-1 items-center gap-2" role="status" aria-live="polite">
      <button type="button" onClick={() => stoppen(true)} aria-label="Aufnahme verwerfen" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-red hover:bg-brand-red-wash">
        <Trash2 size={19} />
      </button>
      <div className="flex min-h-11 flex-1 items-center gap-2 rounded-3xl bg-brand-bg px-4 text-[14px] text-brand-ink">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-red" />
        Aufnahme {dauerText(sekunden)}
      </div>
      <button type="button" onClick={() => stoppen(false)} aria-label="Sprachnachricht senden" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red text-white hover:bg-brand-red-deep">
        <Send size={19} />
      </button>
    </div>
  );
}
