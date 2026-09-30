"use client";

import { useActionState, useState } from "react";
import { CalendarDays, Car, Search } from "lucide-react";
import { fahrtSpeichern } from "@/app/dashboard/fahrgemeinschaften/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { Fahrt, FahrtArt } from "@/lib/fahrgemeinschaften";

export type KalenderVorschlag = { id: string; titel: string; datum: string; ort: string | null; von: string | null };

const TEXTFELD =
  "rounded-[var(--radius-s)] border border-brand-line px-3 py-2.5 text-[13.5px] font-normal text-brand-ink outline-none focus:border-brand-red";

function heute(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

// Fahrt anbieten oder suchen (auch zum Bearbeiten der eigenen Fahrt)
export function FahrtFormular({ fahrt, vorschlaege = [], fertig }: { fahrt?: Fahrt; vorschlaege?: KalenderVorschlag[]; fertig?: () => void }) {
  const [art, setArt] = useState<FahrtArt>(fahrt?.art ?? "angebot");
  const [werte, setWerte] = useState({
    anlass: fahrt?.anlass ?? "",
    ziel: fahrt?.ziel ?? "",
    datum: fahrt?.datum ?? "",
    uhrzeit: fahrt?.uhrzeit ?? "",
  });
  const [runde, setRunde] = useState(0);
  const [ergebnis, aktion] = useActionState(async (prev: typeof LEERES_ERGEBNIS, fd: FormData) => {
    const r = await fahrtSpeichern(prev, fd);
    if (!r.error && !fahrt) {
      setWerte({ anlass: "", ziel: "", datum: "", uhrzeit: "" });
      setRunde((x) => x + 1);
    }
    if (!r.error) fertig?.();
    return r;
  }, LEERES_ERGEBNIS);
  const gesperrt = !!fahrt && fahrt.antworten.some((a) => a.art !== "nachricht");

  const uebernehmen = (id: string) => {
    const t = vorschlaege.find((v) => v.id === id);
    if (t) setWerte({ anlass: t.titel, ziel: t.ort ?? "", datum: t.datum, uhrzeit: t.von ?? "" });
  };

  return (
    <form key={runde} action={aktion} className="flex flex-col gap-3">
      {fahrt && <input type="hidden" name="id" value={fahrt.id} />}
      <input type="hidden" name="art" value={art} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Art">
        {(
          [
            ["angebot", Car, "Ich biete eine Fahrt", "Ich fahre und habe Plätze frei"],
            ["gesuch", Search, "Ich suche eine Mitfahrt", "Wer kann mich mitnehmen?"],
          ] as const
        ).map(([wert, Icon, titel, text]) => (
          <button
            key={wert}
            type="button"
            role="radio"
            aria-checked={art === wert}
            disabled={gesperrt}
            onClick={() => setArt(wert)}
            className={`flex flex-col items-start gap-0.5 rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${
              art === wert ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white hover:bg-brand-bg"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[14px] font-bold text-brand-ink">
              <Icon size={16} className={art === wert ? "text-brand-red" : "text-brand-ink-soft"} /> {titel}
            </span>
            <span className="text-[12px] text-brand-ink-soft">{text}</span>
          </button>
        ))}
      </div>

      {!fahrt && vorschlaege.length > 0 && (
        <label className="field">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} /> Aus dem Vereinskalender übernehmen (optional)
          </span>
          <select defaultValue="" onChange={(e) => uebernehmen(e.target.value)}>
            <option value="">– Termin wählen –</option>
            {vorschlaege.map((v) => (
              <option key={v.id} value={v.id}>
                {new Date(`${v.datum}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} · {v.titel}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Wohin bzw. Anlass</span>
        <input
          name="anlass"
          required
          minLength={2}
          maxLength={120}
          value={werte.anlass}
          onChange={(e) => setWerte({ ...werte, anlass: e.target.value })}
          placeholder="z. B. Turnier in Mannheim"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="field">
          <span>Datum</span>
          <input type="date" name="datum" required min={heute()} value={werte.datum} onChange={(e) => setWerte({ ...werte, datum: e.target.value })} />
        </label>
        <label className="field">
          <span>Abfahrt (optional)</span>
          <input type="time" name="uhrzeit" value={werte.uhrzeit} onChange={(e) => setWerte({ ...werte, uhrzeit: e.target.value })} />
        </label>
        <label className="field">
          <span>{art === "angebot" ? "Freie Plätze" : "Benötigte Plätze"}</span>
          <select name="plaetze" defaultValue={String(fahrt?.plaetze ?? (art === "angebot" ? 3 : 1))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Zielort (optional)</span>
          <input name="ziel" maxLength={150} value={werte.ziel} onChange={(e) => setWerte({ ...werte, ziel: e.target.value })} placeholder="z. B. Rosengarten Mannheim" />
        </label>
        <label className="field">
          <span>{art === "angebot" ? "Treffpunkt / Abfahrtsort" : "Abholort (optional)"}</span>
          <input name="treffpunkt" maxLength={150} defaultValue={fahrt?.treffpunkt ?? ""} placeholder="z. B. Parkplatz Vereinsheim" />
        </label>
      </div>
      <label className="field">
        <span>Fahrt</span>
        <select name="richtung" defaultValue={fahrt?.richtung ?? "hin_rueck"}>
          <option value="hin_rueck">Hin- und Rückfahrt</option>
          <option value="hin">nur Hinfahrt</option>
          <option value="rueck">nur Rückfahrt</option>
        </select>
      </label>
      <label className="field">
        <span>Hinweis (optional)</span>
        <textarea
          name="notiz"
          rows={2}
          maxLength={500}
          defaultValue={fahrt?.notiz ?? ""}
          className={TEXTFELD}
          placeholder={art === "angebot" ? "z. B. Platz für Kostümtaschen, Kindersitz vorhanden" : "z. B. mit Kostümtasche"}
        />
      </label>
      <p className="text-[12px] text-brand-ink-soft">Sichtbar nur für die Mitglieder deines Vereins.</p>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton laedtText="Wird gespeichert …">{fahrt ? "Änderungen speichern" : art === "angebot" ? "Fahrt anbieten" : "Mitfahrt suchen"}</SendenButton>
      </div>
    </form>
  );
}
