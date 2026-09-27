"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { umfrageErstellen } from "@/app/dashboard/news/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { VerfasserVerein } from "@/lib/news/getNews";
import { ZielAuswahl } from "./ZielAuswahl";

function inEinerWoche(): string {
  const d = new Date(Date.now() + 7 * 24 * 3600_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function UmfrageFormular({ vereine }: { vereine: VerfasserVerein[] }) {
  const [vereinId, setVereinId] = useState(vereine[0]?.vereinId ?? "");
  const [optionen, setOptionen] = useState(["", ""]);
  const [runde, setRunde] = useState(0);
  const [ergebnis, aktion] = useActionState(async (prev: typeof LEERES_ERGEBNIS, fd: FormData) => {
    // datetime-local -> ISO mit der Zeitzone des Geraets
    const ende = String(fd.get("endet_am_lokal") ?? "");
    if (ende) fd.set("endet_am", new Date(ende).toISOString());
    const r = await umfrageErstellen(prev, fd);
    if (!r.error) {
      setOptionen(["", ""]);
      setRunde((x) => x + 1);
    }
    return r;
  }, LEERES_ERGEBNIS);
  const verein = vereine.find((v) => v.vereinId === vereinId) ?? vereine[0];

  return (
    <form key={runde} action={aktion} className="flex flex-col gap-3">
      {vereine.length > 1 ? (
        <label className="field">
          <span>Verein</span>
          <select name="verein_id" value={vereinId} onChange={(e) => setVereinId(e.target.value)}>
            {vereine.map((v) => (
              <option key={v.vereinId} value={v.vereinId}>
                {v.vereinName}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="verein_id" value={verein.vereinId} />
      )}
      <label className="field">
        <span>Frage</span>
        <input name="frage" required maxLength={300} placeholder="z. B. Kommst du mit zum Sommerfest?" />
      </label>
      <label className="field">
        <span>Beschreibung (optional)</span>
        <textarea name="beschreibung" rows={2} maxLength={2000} />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-brand-ink">Antwortmöglichkeiten</span>
        {optionen.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              name="option"
              value={o}
              onChange={(e) => setOptionen((alt) => alt.map((x, j) => (j === i ? e.target.value : x)))}
              maxLength={120}
              required={i < 2}
              placeholder={`Antwort ${i + 1}`}
              className="min-h-10 flex-1 rounded-xl border border-brand-line bg-white px-3 text-[14px] outline-none focus:border-brand-red"
            />
            {optionen.length > 2 && (
              <button type="button" onClick={() => setOptionen((alt) => alt.filter((_, j) => j !== i))} aria-label="Antwort entfernen" className="p-2 text-brand-ink-soft hover:text-brand-red">
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        {optionen.length < 10 && (
          <button type="button" onClick={() => setOptionen((alt) => [...alt, ""])} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-brand-red">
            <Plus size={15} /> Antwort hinzufügen
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-brand-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="mehrfach" /> Mehrere Antworten erlaubt
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="anonym" /> Anonym (niemand sieht, wer was gewählt hat)
        </label>
      </div>
      <label className="field">
        <span>Läuft bis</span>
        <input type="datetime-local" name="endet_am_lokal" required defaultValue={inEinerWoche()} />
      </label>
      <ZielAuswahl verein={verein} />
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gestartet …">Umfrage starten</SendenButton>
    </form>
  );
}
