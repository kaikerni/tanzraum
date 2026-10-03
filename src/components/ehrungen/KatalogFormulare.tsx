"use client";

import { useActionState } from "react";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import { pruefungSpeichern, organisationAnlegen, verbandAuszeichnungSpeichern } from "@/app/dashboard/admin/ehrungen/actions";
import { PRUEFSTATUS } from "@/lib/ehrungen/typen";

const TEXTFELD =
  "min-h-[64px] rounded-[var(--radius-s)] border border-brand-line px-3 py-2.5 text-[13.5px] font-normal text-brand-ink outline-none focus:border-brand-red";

export type PruefDaten = {
  id: string;
  pruefstatus: string;
  gepruefAm: string | null;
  quelle: string | null;
  quelleUrl: string | null;
  pruefBemerkung: string | null;
  naechstePruefung: string | null;
  aktiv: boolean;
};

export function PruefungFormular({ tabelle, daten }: { tabelle: "organisation" | "auszeichnung"; daten: PruefDaten }) {
  const [ergebnis, aktion] = useActionState(pruefungSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="auth-form">
      <input type="hidden" name="id" value={daten.id} />
      <input type="hidden" name="tabelle" value={tabelle} />
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Prüfstatus</span>
          <select name="pruefstatus" defaultValue={daten.pruefstatus}>
            {Object.entries(PRUEFSTATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.zeichen} {v.label} – {v.text}
              </option>
            ))}
          </select>
        </label>
        <label className="field sm:max-w-[180px]">
          <span>Geprüft am</span>
          <input type="date" name="geprueft_am" defaultValue={daten.gepruefAm ?? ""} />
        </label>
        <label className="field sm:max-w-[180px]">
          <span>Nächste Überprüfung</span>
          <input type="date" name="naechste_pruefung" defaultValue={daten.naechstePruefung ?? ""} />
        </label>
      </div>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Quelle</span>
          <input name="quelle" defaultValue={daten.quelle ?? ""} />
        </label>
        <label className="field">
          <span>Link zur offiziellen Quelle</span>
          <input name="quelle_url" type="url" defaultValue={daten.quelleUrl ?? ""} placeholder="https://" />
        </label>
      </div>
      <label className="field">
        <span>Bemerkung zur Prüfung</span>
        <textarea name="pruef_bemerkung" defaultValue={daten.pruefBemerkung ?? ""} className={TEXTFELD} />
      </label>
      <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="aktiv" value="ja" defaultChecked={daten.aktiv} className="h-4 w-4 accent-brand-red" /> Aktiv
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton variante="sekundaer">Prüfung speichern</SendenButton>
    </form>
  );
}

export function OrganisationFormular() {
  const [ergebnis, aktion] = useActionState(organisationAnlegen, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="auth-form">
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Name</span>
          <input name="name" required />
        </label>
        <label className="field sm:max-w-[140px]">
          <span>Kürzel</span>
          <input name="kuerzel" />
        </label>
        <label className="field sm:max-w-[200px]">
          <span>Art</span>
          <select name="art" defaultValue="regionalverband">
            <option value="dachverband">Dachverband</option>
            <option value="regionalverband">Regionalverband</option>
            <option value="traditionsverband">Traditionsverband</option>
            <option value="sonstige">Sonstige Organisation</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Beschreibung</span>
        <textarea name="beschreibung" className={TEXTFELD} />
      </label>
      <label className="field">
        <span>Quelle</span>
        <input name="quelle" />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton>Organisation anlegen</SendenButton>
    </form>
  );
}

export type VerbandArt = {
  id?: string;
  name?: string;
  serie?: string | null;
  stufe?: string | null;
  stufeNr?: number | null;
  kategorie?: string | null;
  beschreibung?: string | null;
  voraussetzungen?: string | null;
  regelVerknuepfung?: string;
  automatischeVorschlaege?: boolean;
  bestellungErforderlich?: boolean;
  antragErforderlich?: boolean | null;
};

export function VerbandAuszeichnungFormular({ organisationId, art }: { organisationId?: string; art?: VerbandArt }) {
  const [ergebnis, aktion] = useActionState(verbandAuszeichnungSpeichern, LEERES_ERGEBNIS);
  const w = art ?? {};
  return (
    <form action={aktion} className="auth-form">
      {w.id && <input type="hidden" name="id" value={w.id} />}
      {organisationId && <input type="hidden" name="organisation_id" value={organisationId} />}
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={w.name ?? ""} required />
      </label>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Serie</span>
          <input name="serie" defaultValue={w.serie ?? ""} />
        </label>
        <label className="field">
          <span>Stufe</span>
          <input name="stufe" defaultValue={w.stufe ?? ""} />
        </label>
        <label className="field sm:max-w-[110px]">
          <span>Stufen-Nr.</span>
          <input name="stufe_nr" inputMode="numeric" defaultValue={w.stufeNr ?? ""} />
        </label>
        <label className="field">
          <span>Kategorie</span>
          <input name="kategorie" defaultValue={w.kategorie ?? ""} />
        </label>
      </div>
      <label className="field">
        <span>Voraussetzungen (wie in der Quelle)</span>
        <textarea name="voraussetzungen" defaultValue={w.voraussetzungen ?? ""} className={TEXTFELD} />
      </label>
      <label className="field">
        <span>Beschreibung</span>
        <textarea name="beschreibung" defaultValue={w.beschreibung ?? ""} className={TEXTFELD} />
      </label>
      <label className="field sm:max-w-[320px]">
        <span>Mehrere Regeln</span>
        <select name="regel_verknuepfung" defaultValue={w.regelVerknuepfung ?? "eine"}>
          <option value="eine">Eine Regel genügt</option>
          <option value="alle">Alle Regeln müssen erfüllt sein</option>
        </select>
      </label>
      <div className="flex flex-col gap-2 text-[13.5px] text-brand-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="automatische_vorschlaege" value="ja" defaultChecked={w.automatischeVorschlaege ?? true} className="h-4 w-4 accent-brand-red" />
          Automatische Vorschläge anhand der Regeln
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="bestellung_erforderlich" value="ja" defaultChecked={w.bestellungErforderlich ?? true} className="h-4 w-4 accent-brand-red" />
          Bestellung erforderlich
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="antrag_erforderlich" value="ja" defaultChecked={!!w.antragErforderlich} className="h-4 w-4 accent-brand-red" />
          Antrag beim Verband erforderlich
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <SendenButton>{w.id ? "Auszeichnung speichern" : "Auszeichnung anlegen"}</SendenButton>
    </form>
  );
}
