"use client";

import { useActionState, useState } from "react";
import { startSpeichern, ergebnisSpeichern } from "@/app/dashboard/turniere/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import { datumKurz, type PlanungsVerein, type Stammdaten, type Start, type TurnierTag } from "@/lib/turniere/getTurniere";

export function StartFormular({
  verein,
  turnierId,
  tage,
  stammdaten,
  start,
  onFertig,
}: {
  verein: PlanungsVerein;
  turnierId: string;
  tage: TurnierTag[];
  stammdaten: Stammdaten;
  start?: Start;
  onFertig?: () => void;
}) {
  const [ergebnis, aktion] = useActionState(async (prev: typeof LEERES_ERGEBNIS, fd: FormData) => {
    const r = await startSpeichern(prev, fd);
    if (!r.error && onFertig) onFertig();
    return r;
  }, LEERES_ERGEBNIS);
  const [art, setArt] = useState<"gruppe" | "solo">(start && !start.gruppeId ? "solo" : verein.gruppen.length ? "gruppe" : "solo");

  return (
    <form action={aktion} className="flex flex-col gap-3">
      {start ? <input type="hidden" name="start_id" value={start.id} /> : null}
      <input type="hidden" name="turnier_id" value={turnierId} />
      <input type="hidden" name="verein_id" value={verein.vereinId} />

      <div className="flex gap-1.5" role="radiogroup" aria-label="Art des Starts">
        {(["gruppe", "solo"] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={art === a}
            onClick={() => setArt(a)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${art === a ? "bg-brand-ink text-white" : "bg-brand-bg text-brand-ink-soft"}`}
          >
            {a === "gruppe" ? "Gruppe" : "Solo / Paar"}
          </button>
        ))}
      </div>

      {art === "gruppe" ? (
        <label className="field">
          <span>Gruppe</span>
          <select name="gruppe_id" defaultValue={start?.gruppeId ?? ""} required>
            <option value="" disabled>
              Gruppe wählen
            </option>
            {verein.gruppen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="field">
            <span>Bezeichnung</span>
            <input name="bezeichnung" defaultValue={start?.bezeichnung ?? ""} placeholder="z. B. Tanzmariechen, Tanzpaar" maxLength={120} />
          </label>
          <fieldset className="field">
            <span>Solisten</span>
            <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-brand-line p-2 sm:grid-cols-2">
              {verein.mitglieder.map((m) => (
                <label key={m.vmId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand-ink hover:bg-brand-bg">
                  <input type="checkbox" name="solisten" value={m.vmId} defaultChecked={start?.solisten.includes(m.vmId)} />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Disziplin</span>
          <select name="disziplin_id" defaultValue={start?.disziplinId ?? ""}>
            <option value="">–</option>
            {stammdaten.disziplinen.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Altersklasse</span>
          <select name="altersklasse_id" defaultValue={start?.altersklasseId ?? ""}>
            <option value="">–</option>
            {stammdaten.altersklassen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tag</span>
          <select name="tag" defaultValue={start?.tag ?? (tage.length === 1 ? tage[0].datum : "")}>
            {tage.length > 1 && <option value="">noch offen</option>}
            {tage.map((t) => (
              <option key={t.datum} value={t.datum}>
                {datumKurz(t.datum)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={start?.status ?? "geplant"}>
            <option value="geplant">Geplant</option>
            <option value="gemeldet">Beim Verband gemeldet</option>
            <option value="abgesagt">Abgesagt</option>
          </select>
        </label>
        <label className="field">
          <span>Startnummer</span>
          <input name="startnummer" defaultValue={start?.startnummer ?? ""} maxLength={20} />
        </label>
      </div>
      <label className="field">
        <span>Notiz (für den Verein sichtbar)</span>
        <input name="notiz" defaultValue={start?.notiz ?? ""} maxLength={1000} placeholder="z. B. Treffpunkt 7:30 Uhr am Vereinsheim" />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gespeichert …" className="self-start">
        {start ? "Start speichern" : "Start einplanen"}
      </SendenButton>
    </form>
  );
}

export function ErgebnisFormular({ start }: { start: Start }) {
  const [ergebnis, aktion] = useActionState(ergebnisSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-2">
      <input type="hidden" name="start_id" value={start.id} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[110px_130px_1fr_auto] sm:items-end">
        <label className="field">
          <span>Platz</span>
          <input name="platz" inputMode="numeric" defaultValue={start.platz ?? ""} />
        </label>
        <label className="field">
          <span>Punkte</span>
          <input name="punkte" inputMode="decimal" defaultValue={start.punkte ?? ""} />
        </label>
        <label className="field col-span-2 sm:col-span-1">
          <span>Bemerkung</span>
          <input name="ergebnis_notiz" defaultValue={start.ergebnisNotiz ?? ""} maxLength={300} placeholder="z. B. Qualifiziert für die Meisterschaft" />
        </label>
        <SendenButton laedtText="…" className="col-span-2 sm:col-span-1">
          Speichern
        </SendenButton>
      </div>
      <Meldung ergebnis={ergebnis} />
    </form>
  );
}
