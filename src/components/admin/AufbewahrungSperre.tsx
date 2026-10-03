"use client";

import { useState, useTransition } from "react";
import { aufbewahrungSperren } from "@/app/dashboard/admin/rechnungen/actions";

export function AufbewahrungSperre({ id, gesperrt, grund }: { id: string; gesperrt: boolean; grund: string | null }) {
  const [laeuft, starte] = useTransition();
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  if (gesperrt) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="rounded-full bg-brand-amber-wash px-2 py-0.5 font-semibold text-brand-ink">Gesperrt: {grund}</span>
        <button type="button" disabled={laeuft} onClick={() => starte(async () => void (await aufbewahrungSperren(id, false, "")))} className="text-brand-ink-soft underline">
          aufheben
        </button>
      </span>
    );
  }
  if (!offen) {
    return (
      <button type="button" onClick={() => setOffen(true)} className="text-[12px] text-brand-ink-soft underline">
        Anonymisierung sperren
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Grund, z. B. Betriebsprüfung" className="min-h-8 rounded-lg border border-brand-line px-2 text-[12px]" />
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const r = await aufbewahrungSperren(id, true, text);
            setFehler(r.error);
            if (!r.error) setOffen(false);
          })
        }
        className="rounded-lg bg-brand-red px-2 py-1 text-[12px] font-semibold text-white"
      >
        Sperren
      </button>
      {fehler && <span className="text-[12px] text-brand-red">{fehler}</span>}
    </span>
  );
}
