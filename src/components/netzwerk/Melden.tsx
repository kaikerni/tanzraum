"use client";

import { useState, useTransition } from "react";
import { Flag, X } from "lucide-react";
import { melden } from "@/app/dashboard/netzwerk/actions";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";

const GRUENDE: [string, string][] = [
  ["unangemessen", "Unangemessener Inhalt"],
  ["belaestigung", "Belästigung"],
  ["unerwuenschter_kontakt", "Unerwünschter Kontakt"],
  ["jugendgefaehrdend", "Jugendgefährdender Inhalt"],
  ["spam", "Spam"],
  ["sonstiges", "Sonstiger Verstoß"],
];

// Nutzer oder Spotlight melden – landet beim TanzRaum-Team (Administration → Meldungen)
export function MeldenKnopf({
  userId,
  spotlightId,
  titel = "Melden",
  hell = false,
}: {
  userId?: string;
  spotlightId?: string;
  titel?: string;
  hell?: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const [grund, setGrund] = useState("");
  const [text, setText] = useState("");
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOffen(true);
          setErgebnis(null);
        }}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold ${
          hell ? "bg-white/15 text-white hover:bg-white/25" : "border border-brand-line bg-white text-brand-ink-soft hover:bg-brand-bg"
        }`}
      >
        <Flag size={15} /> {titel}
      </button>
      {offen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={titel}>
          <div className="w-full max-w-[440px] rounded-2xl bg-white p-4 text-brand-ink shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[17px] font-bold">🚩 {titel}</h2>
              <button type="button" onClick={() => setOffen(false)} aria-label="Schließen" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-bg">
                <X size={17} />
              </button>
            </div>
            {ergebnis?.ok ? (
              <>
                <Meldung ergebnis={ergebnis} />
                <button type="button" onClick={() => setOffen(false)} className="mt-3 min-h-10 w-full rounded-xl bg-brand-red text-[13.5px] font-semibold text-white">
                  Schließen
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] text-brand-ink-soft">Was ist das Problem? Deine Meldung sieht nur das TanzRaum-Team.</p>
                {GRUENDE.map(([wert, label]) => (
                  <label key={wert} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13.5px] ${grund === wert ? "border-brand-red bg-brand-red-wash" : "border-brand-line"}`}>
                    <input type="radio" name="grund" value={wert} checked={grund === wert} onChange={() => setGrund(wert)} className="accent-brand-red" />
                    {label}
                  </label>
                ))}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Optional: Was ist passiert?"
                  className="rounded-xl border border-brand-line p-2.5 text-[13.5px] outline-none focus:border-brand-red"
                />
                {ergebnis?.error && <Meldung ergebnis={ergebnis} />}
                <button
                  type="button"
                  disabled={!grund || laeuft}
                  onClick={() => starte(async () => setErgebnis(await melden({ userId, spotlightId }, grund, text)))}
                  className="min-h-11 rounded-xl bg-brand-red text-[14px] font-semibold text-white disabled:opacity-50"
                >
                  {laeuft ? "Wird gesendet …" : "Meldung senden"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
