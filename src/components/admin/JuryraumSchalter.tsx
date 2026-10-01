"use client";

import { useState, useTransition } from "react";
import { Scale } from "lucide-react";
import { juryraumEinstellen } from "@/app/dashboard/admin/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

// Schalter der TanzRaum-Administration: JuryRaum fuer alle an/aus (Standard: aus). Aus = kein Menuepunkt, keine
// Dashboard-Karte, keine Kai-Themen, Direktaufruf gesperrt; alle JuryRaum-Daten bleiben erhalten.
export function JuryraumSchalter({ aktiv: start }: { aktiv: boolean }) {
  const [aktiv, setAktiv] = useState(start);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);

  const umschalten = () => {
    const neu = !aktiv;
    setAktiv(neu);
    starte(async () => {
      const r = await juryraumEinstellen(neu);
      setMeldung(r);
      if (r.error) setAktiv(!neu);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-blue-wash text-brand-blue">
            <Scale size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] font-bold text-brand-ink">JuryRaum</span>
            <span className="block text-[13px] text-brand-ink-soft">
              {aktiv
                ? "Eingeschaltet – berechtigte JuryRaum-Mitglieder sehen den JuryRaum in Menü und Dashboard."
                : "Ausgeschaltet – kein Menüpunkt, keine Dashboard-Karte, Direktaufruf gesperrt. Alle Daten bleiben erhalten."}
            </span>
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aktiv}
          aria-label="JuryRaum für alle ein- oder ausschalten"
          disabled={laeuft}
          onClick={umschalten}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${aktiv ? "bg-brand-green" : "bg-brand-line"}`}
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${aktiv ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </div>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="text-[12.5px] text-brand-green">{meldung.ok}</p>}
    </div>
  );
}
