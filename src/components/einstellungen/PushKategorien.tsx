"use client";

import { useState, useTransition } from "react";
import { pushKategorieSetzen } from "@/app/dashboard/einstellungen/actions";

// Kategorien mit bereits versendeten Benachrichtigungen; die uebrigen werden mit den jeweiligen Funktionen versendet
const KATEGORIEN: { key: string; label: string; aktivImSystem: boolean }[] = [
  { key: "chat", label: "Chat-Nachrichten", aktivImSystem: true },
  { key: "anrufe", label: "Anrufe", aktivImSystem: true },
  { key: "trainingsaenderung", label: "Trainingsänderungen und Ausfälle", aktivImSystem: false },
  { key: "training", label: "Neue Trainingstermine", aktivImSystem: false },
  { key: "abmeldung", label: "Neue Abmeldungen in deinen Gruppen (für Trainer)", aktivImSystem: true },
  { key: "wichtige_news", label: "Wichtige News und TanzRaum-Hinweise", aktivImSystem: true },
  { key: "news", label: "Alle News und TanzRaum-Neuigkeiten", aktivImSystem: true },
  { key: "turniere", label: "Turniere", aktivImSystem: false },
  { key: "fahrgemeinschaften", label: "Fahrgemeinschaften (Reaktionen auf deine Fahrten, Absagen)", aktivImSystem: true },
];

export function PushKategorien({ stand }: { stand: Record<string, boolean> }) {
  const [werte, setWerte] = useState(stand);
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  function setze(key: string, aktiv: boolean) {
    setFehler(null);
    setWerte((w) => ({ ...w, [key]: aktiv }));
    starte(async () => {
      const r = await pushKategorieSetzen(key, aktiv);
      if (r.error) {
        setFehler(r.error);
        setWerte((w) => ({ ...w, [key]: !aktiv }));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <ul className="divide-y divide-brand-line">
        {KATEGORIEN.map((k) => (
          <li key={k.key} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[14px] text-brand-ink">
              {k.label}
              {!k.aktivImSystem && <span className="ml-1.5 text-[11.5px] text-brand-ink-faint">(folgt mit der Funktion)</span>}
            </span>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={!!werte[k.key]}
                disabled={laeuft}
                onChange={(e) => setze(k.key, e.target.checked)}
                aria-label={`Push für ${k.label}`}
              />
              <span className="relative h-6 w-11 rounded-full bg-brand-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand-green peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-red" />
            </label>
          </li>
        ))}
      </ul>
      {fehler && <p className="form-error">{fehler}</p>}
    </div>
  );
}
