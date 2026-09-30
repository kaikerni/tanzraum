"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2, X } from "lucide-react";
import { ausgeben, satzLoeschen, satzSpeichern, teilLoeschen, teilSpeichern, zuruecknehmen } from "@/app/dashboard/kostueme/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { ARTEN, ART_LABEL, ZUSTAENDE, ZUSTAND_LABEL, heuteBerlin, type Kostuemsatz, type Teil } from "@/lib/kostueme";

export type Person = { vmId: string; name: string };

const KNOPF = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-2.5 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50";

function mitFertig(fn: (p: AktionsErgebnis, fd: FormData) => Promise<AktionsErgebnis>, fertig?: () => void) {
  return async (p: AktionsErgebnis, fd: FormData) => {
    const r = await fn(p, fd);
    if (!r.error) fertig?.();
    return r;
  };
}

// Neues Teil (auch mehrere Stuecke/Groessen auf einmal) oder bestehendes bearbeiten
export function TeilFormular({ vereinId, saetze, teil, fertig }: { vereinId: string; saetze: Kostuemsatz[]; teil?: Teil; fertig?: () => void }) {
  const [runde, setRunde] = useState(0);
  const [ergebnis, aktion] = useActionState(
    mitFertig(teilSpeichern, () => {
      if (!teil) setRunde((x) => x + 1);
      fertig?.();
    }),
    LEERES_ERGEBNIS,
  );
  return (
    <form key={runde} action={aktion} className="flex flex-col gap-3">
      {teil ? <input type="hidden" name="id" value={teil.id} /> : <input type="hidden" name="verein_id" value={vereinId} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field sm:col-span-2">
          <span>Bezeichnung *</span>
          <input name="teil" required maxLength={120} defaultValue={teil?.teil} placeholder="z. B. Gardejacke rot, Pompons gold" />
        </label>
        <label className="field">
          <span>Art</span>
          <select name="art" defaultValue={teil?.art ?? "kostuem"}>
            {ARTEN.map((a) => (
              <option key={a} value={a}>
                {ART_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Kostümsatz</span>
          <select name="satz" defaultValue={teil?.kostuem_gruppe_id ?? ""}>
            <option value="">– keiner –</option>
            {saetze.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {teil ? (
          <label className="field">
            <span>Größe</span>
            <input name="groesse" maxLength={40} defaultValue={teil.groesse ?? ""} placeholder="z. B. 140, M, 38" />
          </label>
        ) : (
          <label className="field sm:col-span-2">
            <span>Größen (optional, mit Komma – je Größe ein Stück)</span>
            <input name="groessen" maxLength={400} placeholder="z. B. 128, 134, 140, 140, 146" />
          </label>
        )}
        {!teil && (
          <label className="field">
            <span>Stückzahl (ohne Größen)</span>
            <input name="stueck" type="number" min={1} max={50} defaultValue={1} />
          </label>
        )}
        <label className="field">
          <span>Menge je Eintrag</span>
          <input name="anzahl" type="number" min={1} max={9999} defaultValue={teil?.anzahl ?? 1} title="z. B. 12 bei einem Satz Pompons, der zusammen ausgegeben wird" />
        </label>
        <label className="field">
          <span>Zustand</span>
          <select name="zustand" defaultValue={teil?.zustand ?? "gut"}>
            {ZUSTAENDE.map((z) => (
              <option key={z} value={z}>
                {ZUSTAND_LABEL[z]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Lagerort</span>
          <input name="lagerort" maxLength={120} defaultValue={teil?.lagerort ?? ""} placeholder="z. B. Vereinsheim, Schrank 2" />
        </label>
        <label className="field sm:col-span-2 lg:col-span-4">
          <span>Notiz</span>
          <input name="notiz" maxLength={1000} defaultValue={teil?.notiz ?? ""} placeholder="z. B. mit Hut, Reißverschluss neu" />
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div className="flex flex-wrap gap-2">
        <SendenButton>{teil ? "Speichern" : "Hinzufügen"}</SendenButton>
        {fertig && (
          <button type="button" onClick={fertig} className={KNOPF}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}

function AusgabeFormular({ teil, personen, fertig }: { teil: Teil; personen: Person[]; fertig: () => void }) {
  const [ergebnis, aktion] = useActionState(mitFertig(ausgeben, fertig), LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={teil.id} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="field">
          <span>An *</span>
          <select name="person" required defaultValue="">
            <option value="" disabled>
              – Person wählen –
            </option>
            {personen.map((p) => (
              <option key={p.vmId} value={p.vmId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Rückgabe bis</span>
          <input name="bis" type="date" min={heuteBerlin()} />
        </label>
        <label className="field">
          <span>Notiz</span>
          <input name="notiz" maxLength={500} placeholder="optional" />
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div className="flex gap-2">
        <SendenButton laedtText="Wird ausgegeben …">Ausgeben</SendenButton>
        <button type="button" onClick={fertig} className={KNOPF}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function RuecknahmeFormular({ teil, fertig }: { teil: Teil; fertig: () => void }) {
  const [ergebnis, aktion] = useActionState(mitFertig(zuruecknehmen, fertig), LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={teil.id} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="field">
          <span>Zustand bei Rückgabe</span>
          <select name="zustand" defaultValue={teil.zustand}>
            {ZUSTAENDE.map((z) => (
              <option key={z} value={z}>
                {ZUSTAND_LABEL[z]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Notiz</span>
          <input name="notiz" maxLength={500} placeholder="z. B. gewaschen, Knopf fehlt" />
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div className="flex gap-2">
        <SendenButton laedtText="Wird zurückgenommen …">Zurücknehmen</SendenButton>
        <button type="button" onClick={fertig} className={KNOPF}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// Aktionen je Teil in der Inventarliste
export function TeilAktionen({ teil, vereinId, saetze, personen }: { teil: Teil; vereinId: string; saetze: Kostuemsatz[]; personen: Person[] }) {
  const [offen, setOffen] = useState<"bearbeiten" | "ausgeben" | "zurueck" | null>(null);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const zu = () => setOffen(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {teil.vereins_mitglied_id ? (
          <button type="button" className={KNOPF} onClick={() => setOffen(offen === "zurueck" ? null : "zurueck")}>
            <ArrowDownToLine size={14} /> Zurücknehmen
          </button>
        ) : (
          <button type="button" className={KNOPF} onClick={() => setOffen(offen === "ausgeben" ? null : "ausgeben")}>
            <ArrowUpFromLine size={14} /> Ausgeben
          </button>
        )}
        <button type="button" className={KNOPF} onClick={() => setOffen(offen === "bearbeiten" ? null : "bearbeiten")} aria-label="Bearbeiten">
          <Pencil size={14} />
          <span className="hidden sm:inline">Bearbeiten</span>
        </button>
        {!teil.vereins_mitglied_id && (
          <button
            type="button"
            disabled={laeuft}
            className={`${KNOPF} text-brand-red`}
            aria-label="Löschen"
            onClick={() => window.confirm(`„${teil.teil}“ aus dem Inventar löschen?`) && starte(async () => setMeldung(await teilLoeschen(teil.id)))}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {offen && (
        <div className="rounded-xl border border-brand-line bg-brand-bg/60 p-3">
          {offen === "bearbeiten" && <TeilFormular vereinId={vereinId} saetze={saetze} teil={teil} fertig={zu} />}
          {offen === "ausgeben" && <AusgabeFormular teil={teil} personen={personen} fertig={zu} />}
          {offen === "zurueck" && <RuecknahmeFormular teil={teil} fertig={zu} />}
        </div>
      )}
    </div>
  );
}

export function SatzFormular({ vereinId, satz, fertig }: { vereinId: string; satz?: Kostuemsatz; fertig?: () => void }) {
  const [runde, setRunde] = useState(0);
  const [ergebnis, aktion] = useActionState(
    mitFertig(satzSpeichern, () => {
      if (!satz) setRunde((x) => x + 1);
      fertig?.();
    }),
    LEERES_ERGEBNIS,
  );
  return (
    <form key={runde} action={aktion} className="flex flex-col gap-2">
      {satz ? <input type="hidden" name="id" value={satz.id} /> : <input type="hidden" name="verein_id" value={vereinId} />}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_2fr]">
        <label className="field">
          <span>Name *</span>
          <input name="name" required maxLength={80} defaultValue={satz?.name} placeholder="z. B. Gardeuniform rot 2026" />
        </label>
        <label className="field">
          <span>Farbe</span>
          <input name="farbe" type="color" defaultValue={satz?.farbe ?? "#c8102e"} className="h-11 w-16 p-1" />
        </label>
        <label className="field">
          <span>Beschreibung</span>
          <input name="beschreibung" maxLength={500} defaultValue={satz?.beschreibung ?? ""} placeholder="z. B. Juniorengarde, Jacke + Rock + Hut" />
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div className="flex gap-2">
        <SendenButton>{satz ? "Speichern" : "Kostümsatz anlegen"}</SendenButton>
        {fertig && (
          <button type="button" onClick={fertig} className={KNOPF}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}

export function SatzAktionen({ satz, vereinId }: { satz: Kostuemsatz; vereinId: string }) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        <button type="button" className={KNOPF} onClick={() => setOffen((v) => !v)} aria-label="Bearbeiten">
          {offen ? <X size={14} /> : <Pencil size={14} />}
        </button>
        <button
          type="button"
          disabled={laeuft}
          className={`${KNOPF} text-brand-red`}
          aria-label="Löschen"
          onClick={() => window.confirm(`Kostümsatz „${satz.name}“ löschen? Die Teile bleiben im Inventar.`) && starte(async () => setMeldung(await satzLoeschen(satz.id)))}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {offen && (
        <div className="rounded-xl border border-brand-line bg-brand-bg/60 p-3">
          <SatzFormular vereinId={vereinId} satz={satz} fertig={() => setOffen(false)} />
        </div>
      )}
    </div>
  );
}
