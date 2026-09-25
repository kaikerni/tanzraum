"use client";

import { useState, useTransition } from "react";
import { tarifWaehlen } from "../actions";
import { euro, type Preise } from "@/lib/tarife";

type Tarif = "free" | "basic" | "verein";
type Periode = "monat" | "jahr";

const TARIFE: { id: Tarif; icon: string; name: string; beschreibung: string }[] = [
  { id: "free", icon: "🆓", name: "Free", beschreibung: "Kostenlos, dauerhaft" },
  { id: "basic", icon: "⭐", name: "Basic", beschreibung: "Für dich persönlich" },
  { id: "verein", icon: "🏆", name: "Verein", beschreibung: "Lizenz für deinen ganzen Verein" },
];

export function TarifForm({ preise }: { preise: Preise | null }) {
  const [gewaehlt, setGewaehlt] = useState<Tarif | null>(null);
  const [periode, setPeriode] = useState<Periode>("monat");
  const [pending, startTransition] = useTransition();

  function weiter() {
    if (!gewaehlt) return;
    startTransition(() => {
      tarifWaehlen(gewaehlt, periode);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-full border border-brand-line bg-white p-1 text-[12.5px]">
          <button
            type="button"
            onClick={() => setPeriode("monat")}
            className={`rounded-full px-3 py-1 font-medium ${periode === "monat" ? "bg-brand-red text-white" : "text-brand-ink-soft"}`}
          >
            Monatlich
          </button>
          <button
            type="button"
            onClick={() => setPeriode("jahr")}
            className={`rounded-full px-3 py-1 font-medium ${periode === "jahr" ? "bg-brand-red text-white" : "text-brand-ink-soft"}`}
          >
            Jährlich · 🎁 2 Monate gratis
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {TARIFE.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setGewaehlt(t.id)}
            className={`flex items-center justify-between rounded-xl border px-4 py-4 text-left transition-colors ${
              gewaehlt === t.id
                ? "border-brand-red bg-brand-red-wash"
                : "border-brand-line bg-white hover:border-brand-gold"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.icon}</span>
              <div>
                <div className="font-display text-[15px] font-bold text-brand-ink">{t.name}</div>
                <div className="text-[12.5px] text-brand-ink-soft">{t.beschreibung}</div>
              </div>
            </div>
            <div className="text-[13px] font-semibold text-brand-ink">
              {t.id === "free"
                ? "kostenlos"
                : preise
                  ? `${euro(preise[t.id][periode])}/${periode === "monat" ? "Monat" : "Jahr"}`
                  : ""}
            </div>
          </button>
        ))}
      </div>

      <p className="text-[12px] text-brand-ink-soft">
        Bei Basic/Verein merken wir uns nur deinen Wunsch. Am Ende geht es direkt zur Bezahlung
        (Karte/Lastschrift oder PayPal) – freigeschaltet wird nach bestätigter Zahlung.
      </p>

      <button
        type="button"
        onClick={weiter}
        disabled={!gewaehlt || pending}
        className="btn-primary mt-2 disabled:opacity-50"
      >
        {pending ? "Speichern…" : "Weiter"}
      </button>
    </div>
  );
}
