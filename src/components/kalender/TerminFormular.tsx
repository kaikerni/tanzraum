"use client";

import { useActionState, useState } from "react";
import { terminSpeichern } from "@/app/dashboard/kalender/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { TerminArt, Zielgruppe } from "@/lib/kalender/getKalender";

export type TerminZiel = { vereinId: string; vereinName: string; gruppen: { id: string; name: string }[] };

export type TerminVorgabe = {
  id: string;
  vereinId: string | null;
  art: TerminArt;
  titel: string;
  beschreibung: string | null;
  ort: string | null;
  datum: string;
  bisDatum: string | null;
  von: string | null;
  bis: string | null;
  zielgruppe: Zielgruppe;
  gruppeIds: string[];
  rueckmeldung: boolean;
};

const ARTEN: [TerminArt, string][] = [
  ["veranstaltung", "Veranstaltung"],
  ["auftritt", "Auftritt"],
  ["sitzung", "Sitzung"],
  ["sonstiges", "Sonstiges"],
];

const ZIELGRUPPEN: [Zielgruppe, string, string][] = [
  ["verein", "Ganzer Verein", "Alle aktiven Mitglieder (Eltern sehen es für ihre Kinder)"],
  ["gruppen", "Bestimmte Gruppen", "Mitglieder, Trainer und Betreuer der gewählten Gruppen"],
  ["leitung", "Nur Vorstand & Trainer", "z. B. für Sitzungen"],
];

function Auswahl<T extends string>({
  name,
  wert,
  setWert,
  optionen,
  spalten = "grid-cols-2 sm:grid-cols-4",
}: {
  name: string;
  wert: T;
  setWert: (w: T) => void;
  optionen: [T, string][];
  spalten?: string;
}) {
  return (
    <div className={`grid gap-2 ${spalten}`}>
      {optionen.map(([w, label]) => (
        <label
          key={w}
          className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-[13px] font-semibold ${
            wert === w ? "border-brand-red bg-brand-red-wash text-brand-red-deep" : "border-brand-line bg-white text-brand-ink"
          }`}
        >
          <input type="radio" name={name} value={w} checked={wert === w} onChange={() => setWert(w)} className="sr-only" />
          {label}
        </label>
      ))}
    </div>
  );
}

export function TerminFormular({
  ziele,
  privatErlaubt,
  vorgabe,
  startDatum,
}: {
  ziele: TerminZiel[];
  privatErlaubt: boolean;
  vorgabe?: TerminVorgabe;
  startDatum: string;
}) {
  const [ergebnis, aktion] = useActionState(terminSpeichern, LEERES_ERGEBNIS);
  const bearbeiten = Boolean(vorgabe);
  const [wo, setWo] = useState<string>(vorgabe ? (vorgabe.vereinId ?? "privat") : privatErlaubt ? "privat" : (ziele[0]?.vereinId ?? ""));
  const [art, setArt] = useState<TerminArt>(vorgabe && vorgabe.art !== "privat" ? vorgabe.art : "veranstaltung");
  const [zielgruppe, setZielgruppe] = useState<Zielgruppe>(vorgabe?.zielgruppe ?? "verein");
  const [ganztags, setGanztags] = useState(vorgabe ? !vorgabe.von : false);
  const [mehrtaegig, setMehrtaegig] = useState(Boolean(vorgabe?.bisDatum));
  const [datum, setDatum] = useState(vorgabe?.datum ?? startDatum);
  const privat = wo === "privat";
  const ziel = ziele.find((z) => z.vereinId === wo);

  return (
    <form action={aktion} className="flex flex-col gap-5">
      {vorgabe && <input type="hidden" name="id" value={vorgabe.id} />}
      <input type="hidden" name="wo" value={wo} />

      <fieldset className="flex flex-col gap-2" disabled={bearbeiten}>
        <legend className="mb-1 text-[12.5px] font-semibold text-brand-ink-soft">Wo eintragen?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {privatErlaubt && (
            <button
              type="button"
              onClick={() => setWo("privat")}
              aria-pressed={privat}
              className={`flex min-h-12 flex-col items-start justify-center rounded-xl border px-3.5 text-left ${
                privat ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white"
              } disabled:opacity-70`}
            >
              <span className="text-[13.5px] font-semibold text-brand-ink">Mein Kalender (privat)</span>
              <span className="text-[12px] text-brand-ink-soft">Nur für dich sichtbar</span>
            </button>
          )}
          {ziele.map((z) => (
            <button
              key={z.vereinId}
              type="button"
              onClick={() => setWo(z.vereinId)}
              aria-pressed={wo === z.vereinId}
              className={`flex min-h-12 flex-col items-start justify-center rounded-xl border px-3.5 text-left ${
                wo === z.vereinId ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white"
              } disabled:opacity-70`}
            >
              <span className="text-[13.5px] font-semibold text-brand-ink">{z.vereinName}</span>
              <span className="text-[12px] text-brand-ink-soft">Vereinstermin</span>
            </button>
          ))}
        </div>
        {bearbeiten && <p className="text-[12px] text-brand-ink-faint">Wo ein Termin eingetragen ist, lässt sich nachträglich nicht ändern.</p>}
      </fieldset>

      {!privat && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[12.5px] font-semibold text-brand-ink-soft">Art</legend>
          <Auswahl name="art" wert={art} setWert={setArt} optionen={ARTEN} />
        </fieldset>
      )}

      <label className="field">
        <span>Titel</span>
        <input name="titel" required maxLength={120} defaultValue={vorgabe?.titel} placeholder={privat ? "z. B. Zahnarzt" : "z. B. Prunksitzung"} />
      </label>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="field">
            <span>{mehrtaegig ? "Von (Datum)" : "Datum"}</span>
            <input type="date" name="datum" required value={datum} onChange={(e) => setDatum(e.target.value)} />
          </label>
          {mehrtaegig && (
            <label className="field">
              <span>Bis (Datum)</span>
              <input type="date" name="bis_datum" required min={datum} defaultValue={vorgabe?.bisDatum ?? ""} />
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex min-h-10 items-center gap-2 text-[13.5px] text-brand-ink">
            <input type="checkbox" name="mehrtaegig" checked={mehrtaegig} onChange={(e) => setMehrtaegig(e.target.checked)} className="h-4 w-4 accent-brand-red" />
            Mehrtägig
          </label>
          <label className="flex min-h-10 items-center gap-2 text-[13.5px] text-brand-ink">
            <input type="checkbox" name="ganztags" checked={ganztags} onChange={(e) => setGanztags(e.target.checked)} className="h-4 w-4 accent-brand-red" />
            Ganztägig
          </label>
        </div>
        {!ganztags && (
          <div className="grid grid-cols-2 gap-4">
            <label className="field">
              <span>Beginn</span>
              <input type="time" name="von" required defaultValue={vorgabe?.von ?? ""} />
            </label>
            <label className="field">
              <span>Ende (optional)</span>
              <input type="time" name="bis" defaultValue={vorgabe?.bis ?? ""} />
            </label>
          </div>
        )}
      </div>

      <label className="field">
        <span>Ort (optional)</span>
        <input name="ort" maxLength={200} defaultValue={vorgabe?.ort ?? ""} placeholder="z. B. Festhalle Zeiskam" />
      </label>

      <label className="field">
        <span>Beschreibung (optional)</span>
        <textarea
          name="beschreibung"
          rows={4}
          maxLength={2000}
          defaultValue={vorgabe?.beschreibung ?? ""}
          className="rounded-lg border border-brand-line px-3 py-2.5 text-[13.5px] font-normal text-brand-ink outline-none focus:border-brand-red"
          placeholder={privat ? "" : "z. B. Treffpunkt, Kostüm, Mitbringen …"}
        />
      </label>

      {!privat && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[12.5px] font-semibold text-brand-ink-soft">Für wen?</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ZIELGRUPPEN.map(([w, label, text]) => (
                <label
                  key={w}
                  className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border px-3.5 py-2 ${
                    zielgruppe === w ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white"
                  }`}
                >
                  <input type="radio" name="zielgruppe" value={w} checked={zielgruppe === w} onChange={() => setZielgruppe(w)} className="sr-only" />
                  <span className="text-[13.5px] font-semibold text-brand-ink">{label}</span>
                  <span className="text-[12px] text-brand-ink-soft">{text}</span>
                </label>
              ))}
            </div>
            {zielgruppe === "gruppen" &&
              (ziel && ziel.gruppen.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {ziel.gruppen.map((g) => (
                    <label key={g.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-brand-line bg-white px-3 text-[13px] text-brand-ink has-[:checked]:border-brand-red has-[:checked]:bg-brand-red-wash">
                      <input type="checkbox" name="gruppen" value={g.id} defaultChecked={vorgabe?.gruppeIds.includes(g.id)} className="h-4 w-4 accent-brand-red" />
                      {g.name}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-brand-ink-soft">In diesem Verein gibt es noch keine Gruppen.</p>
              ))}
          </fieldset>

          <label className="flex min-h-11 items-start gap-2.5 rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px] text-brand-ink">
            <input type="checkbox" name="rueckmeldung" defaultChecked={vorgabe?.rueckmeldung ?? art !== "sitzung"} className="mt-0.5 h-4 w-4 accent-brand-red" />
            <span>
              <span className="font-semibold">Zu- und Absagen abfragen</span>
              <span className="block text-[12.5px] text-brand-ink-soft">Eingeladene (bzw. deren Eltern) können zusagen, absagen oder „vielleicht“ wählen.</span>
            </span>
          </label>
          {!bearbeiten && (
            <p className="text-[12.5px] text-brand-ink-soft">Alle Eingeladenen bekommen eine Benachrichtigung und am Vortag eine Erinnerung.</p>
          )}
        </>
      )}

      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton laedtText="Wird gespeichert …">{bearbeiten ? "Änderungen speichern" : "Termin anlegen"}</SendenButton>
      </div>
    </form>
  );
}
