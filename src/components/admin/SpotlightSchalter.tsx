"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { spotlightsEinstellen } from "@/app/dashboard/admin/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

const TARIFE = [
  { id: "free", label: "FREE", text: "nur ansehen" },
  { id: "basic", label: "BASIC", text: "ansehen & erstellen" },
  { id: "verein", label: "VEREIN", text: "ansehen & erstellen" },
];

// Schalter der TanzRaum-Administration: Spotlights fuer alle an/aus und fuer welche Tarife sie erscheinen.
// Die Administration selbst sieht und erstellt Spotlights, sobald sie eingeschaltet sind.
export function SpotlightSchalter({ aktiv: start, tarife: startTarife }: { aktiv: boolean; tarife: string[] }) {
  const [aktiv, setAktiv] = useState(start);
  const [tarife, setTarife] = useState(startTarife);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);

  const speichern = (neuAktiv: boolean, neuTarife: string[]) => {
    const alt = { aktiv, tarife };
    setAktiv(neuAktiv);
    setTarife(neuTarife);
    starte(async () => {
      const r = await spotlightsEinstellen(neuAktiv, neuTarife);
      setMeldung(r);
      if (r.error) {
        setAktiv(alt.aktiv);
        setTarife(alt.tarife);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gold-wash text-brand-gold">
            <Sparkles size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] font-bold text-brand-ink">Spotlights</span>
            <span className="block text-[13px] text-brand-ink-soft">
              {aktiv ? "Eingeschaltet – 24-Stunden-Fotos im TanzRaum-Netzwerk und in Profilen." : "Ausgeschaltet – für alle ausgeblendet, nichts wird gelöscht."}
            </span>
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aktiv}
          aria-label="Spotlights für alle ein- oder ausschalten"
          disabled={laeuft}
          onClick={() => speichern(!aktiv, tarife)}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${aktiv ? "bg-brand-green" : "bg-brand-line"}`}
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${aktiv ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </div>

      <fieldset disabled={!aktiv || laeuft} className="flex flex-col gap-2 disabled:opacity-50">
        <legend className="mb-1 text-[13px] font-semibold text-brand-ink">Spotlights erscheinen für</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TARIFE.map((t) => {
            const an = tarife.includes(t.id);
            return (
              <label
                key={t.id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 ${an ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white"}`}
              >
                <input
                  type="checkbox"
                  checked={an}
                  onChange={() => speichern(aktiv, an ? tarife.filter((x) => x !== t.id) : [...tarife, t.id])}
                  className="h-4 w-4 accent-brand-red"
                />
                <span>
                  <span className="block text-[14px] font-bold text-brand-ink">{t.label}</span>
                  <span className="block text-[12px] text-brand-ink-soft">{t.text}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-[12px] text-brand-ink-soft">
          Du als TanzRaum-Admin siehst und erstellst Spotlights immer, solange sie eingeschaltet sind. Erstellen geht ab BASIC bzw. über einen Verein
          mit Lizenz; FREE kann nur ansehen.
        </p>
      </fieldset>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="text-[12.5px] font-semibold text-brand-green">{meldung.ok}</p>}
    </div>
  );
}
