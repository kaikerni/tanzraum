"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2, RotateCcw, AlertTriangle, Plus } from "lucide-react";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import {
  vorschlaegeAktualisieren,
  vorgangBearbeiten,
  statusSetzen,
  zuruecksetzen,
  korrekturBerechnen,
  vorgangLoeschen,
  ehrungManuellAnlegen,
  zeitraumSpeichern,
  zeitraumLoeschen,
  auszeichnungSpeichern,
  regelSpeichern,
  regelLoeschen,
  regelAnpassen,
  regelAnpassungZuruecksetzen,
  organisationenSpeichern,
} from "@/app/dashboard/vereinsverwaltung/ehrungen/actions";
import {
  BERECHNUNG,
  HINWEIS_BESTELLUNG,
  PRUEFSTATUS,
  STATUS,
  TYP,
  ZEITRAUM_ART,
  regelKurz,
  wirksameRegel,
  type Anpassung,
  type Auszeichnung,
  type Regel,
  type Status,
  type Vorgang,
} from "@/lib/ehrungen/typen";
import type { Organisation, Zeitraum } from "@/lib/ehrungen/daten";

export const TEXTFELD =
  "min-h-[76px] rounded-[var(--radius-s)] border border-brand-line px-3 py-2.5 text-[13.5px] font-normal text-brand-ink outline-none focus:border-brand-red";
const KNOPF_KLEIN =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-60";

function Hinweis({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-normal text-brand-ink-faint">{children}</p>;
}

function artenOptionen(arten: Auszeichnung[]) {
  const gruppen = new Map<string, Auszeichnung[]>();
  for (const a of arten) {
    const k = a.typ === "verband" ? `${TYP.verband.zeichen} ${a.organisation ?? "Verband"}` : `${TYP.verein.zeichen} Vereinsintern`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), a]);
  }
  return [...gruppen.entries()].map(([k, liste]) => (
    <optgroup key={k} label={k}>
      {liste.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.aktiv ? "" : " (inaktiv)"}
        </option>
      ))}
    </optgroup>
  ));
}

// ---------------------------------------------------------------------------------------------
export function AktualisierenKnopf({ vereinId }: { vereinId: string }) {
  const [laeuft, starten] = useTransition();
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>(LEERES_ERGEBNIS);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starten(async () => {
            setErgebnis(await vorschlaegeAktualisieren(vereinId));
            router.refresh();
          })
        }
        className={KNOPF_KLEIN}
      >
        <RefreshCw size={15} className={laeuft ? "animate-spin" : ""} /> {laeuft ? "Wird berechnet …" : "Mögliche Ehrungen neu berechnen"}
      </button>
      <Meldung ergebnis={ergebnis} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
export function VorgangBearbeiten({ vorgang, arten }: { vorgang: Vorgang; arten: Auszeichnung[] }) {
  const [ergebnis, aktion] = useActionState(vorgangBearbeiten, LEERES_ERGEBNIS);
  const gesperrt = vorgang.status === "verliehen";
  return (
    <form action={aktion} className="auth-form">
      <input type="hidden" name="id" value={vorgang.id} />
      <label className="field">
        <span>Auszeichnung</span>
        <select name="ehrungsart_id" defaultValue={vorgang.ehrungsartId} disabled={gesperrt}>
          {artenOptionen(arten)}
        </select>
        {gesperrt && <input type="hidden" name="ehrungsart_id" value={vorgang.ehrungsartId} />}
      </label>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Voraussichtlich fällig am</span>
          <input type="date" name="faellig_am" defaultValue={vorgang.faelligAm ?? ""} disabled={gesperrt} />
          {gesperrt && <input type="hidden" name="faellig_am" value={vorgang.faelligAm ?? ""} />}
        </label>
        <label className="field">
          <span>Gewünschtes Verleihungsdatum</span>
          <input type="date" name="wunsch_datum" defaultValue={vorgang.wunschDatum ?? ""} />
        </label>
      </div>
      <label className="field">
        <span>Grund / Berechnungsgrundlage (Text)</span>
        <textarea name="grundlage_text" defaultValue={vorgang.grundlageText ?? ""} className={TEXTFELD} disabled={gesperrt} />
        {gesperrt && <input type="hidden" name="grundlage_text" value={vorgang.grundlageText ?? ""} />}
        <Hinweis>Ergänzt die automatische Berechnung, z. B. „laut Vereinsunterlagen seit 1998 aktiv“.</Hinweis>
      </label>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Anlass</span>
          <input name="anlass" defaultValue={vorgang.anlass ?? ""} placeholder="z. B. Jahreshauptversammlung" />
        </label>
        <label className="field">
          <span>Veranstaltung</span>
          <input name="veranstaltung" defaultValue={vorgang.veranstaltung ?? ""} placeholder="z. B. Prunksitzung 2027" />
        </label>
      </div>
      <label className="field">
        <span>Bemerkung</span>
        <textarea name="begruendung" defaultValue={vorgang.begruendung ?? ""} className={TEXTFELD} />
      </label>
      <label className="field">
        <span>Interne Notiz</span>
        <textarea name="interne_notiz" defaultValue={vorgang.interneNotiz ?? ""} className={TEXTFELD} />
      </label>
      <label className="field">
        <span>Begründung der Änderung (für die Historie, optional)</span>
        <input name="aenderungs_begruendung" placeholder="z. B. Rücksprache mit Verband" />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton>Änderungen speichern</SendenButton>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
const NAECHSTE: Partial<Record<Status, Status[]>> = {
  moeglich: ["geprueft", "vorgemerkt", "nicht_vorgesehen", "abgelehnt"],
  geprueft: ["vorgemerkt", "moeglich", "nicht_vorgesehen", "abgelehnt"],
  vorgemerkt: ["bestellt", "eingeplant", "verliehen", "geprueft", "nicht_vorgesehen", "abgelehnt"],
  bestellt: ["erhalten", "vorgemerkt", "abgelehnt"],
  erhalten: ["eingeplant", "verliehen"],
  eingeplant: ["verliehen", "erhalten", "vorgemerkt"],
  nicht_vorgesehen: ["moeglich", "vorgemerkt"],
  abgelehnt: ["moeglich", "vorgemerkt"],
};

export function StatusWechsel({ vorgang }: { vorgang: Vorgang }) {
  const optionen = NAECHSTE[vorgang.status] ?? [];
  const [status, setStatus] = useState<Status | "">(optionen[0] ?? "");
  const [ergebnis, aktion] = useActionState(statusSetzen, LEERES_ERGEBNIS);
  if (vorgang.status === "verliehen") {
    return <p className="text-[13px] text-brand-ink-soft">Diese Ehrung ist verliehen und dauerhaft in der Ehrungshistorie gespeichert.</p>;
  }
  // Keine Bestellung noetig -> "bestellt" nicht anbieten
  const liste = optionen.filter((s) => s !== "bestellt" || vorgang.bestellungErforderlich);
  const datumLabel: Partial<Record<Status, string>> = {
    bestellt: "Bestelldatum",
    erhalten: "Erhalten am",
    eingeplant: "Geplantes Verleihungsdatum",
    verliehen: "Verliehen am",
  };
  return (
    <form action={aktion} className="auth-form" key={vorgang.status}>
      <input type="hidden" name="id" value={vorgang.id} />
      <label className="field">
        <span>Neuer Status</span>
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {liste.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].zeichen} {STATUS[s].label}
            </option>
          ))}
        </select>
      </label>
      {status && datumLabel[status] && (
        <label className="field">
          <span>{datumLabel[status]}</span>
          <input type="date" name="datum" defaultValue={status === "eingeplant" ? (vorgang.wunschDatum ?? "") : ""} required={status === "eingeplant" || status === "verliehen"} />
        </label>
      )}
      {(status === "eingeplant" || status === "verliehen") && (
        <label className="field">
          <span>Veranstaltung</span>
          <input name="veranstaltung" defaultValue={vorgang.veranstaltung ?? ""} />
        </label>
      )}
      {status === "verliehen" && (
        <>
          <div className="field-row flex-wrap">
            <label className="field">
              <span>Verliehen durch</span>
              <input name="verliehen_durch" placeholder="z. B. Präsident des Verbandes" />
            </label>
            <label className="field">
              <span>Anlass</span>
              <input name="anlass" defaultValue={vorgang.anlass ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>Bemerkung zur Verleihung</span>
            <textarea name="verleihung_bemerkung" className={TEXTFELD} />
          </label>
          <Hinweis>Nach dem Speichern wird der damalige Stand der Auszeichnung festgehalten; die Verleihung kann danach nicht mehr verändert werden.</Hinweis>
        </>
      )}
      {status === "bestellt" && (
        <div className="flex flex-col gap-2 rounded-xl border border-brand-amber/50 bg-brand-amber-wash p-3 text-[13px] text-brand-ink">
          <p className="flex gap-2">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#8a5a00]" />
            {HINWEIS_BESTELLUNG}
          </p>
          <label className="flex items-start gap-2 font-semibold">
            <input type="checkbox" name="geprueft" value="ja" required className="mt-0.5 h-4 w-4 accent-brand-red" />
            Ich habe die Angaben geprüft und möchte die Ehrung zur Bestellung vorbereiten.
          </label>
        </div>
      )}
      <label className="field">
        <span>Begründung (optional, für die Historie)</span>
        <input name="aenderungs_begruendung" />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton>Status ändern</SendenButton>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
export function KorrekturFormular({ vorgang }: { vorgang: Vorgang }) {
  const [ergebnis, aktion] = useActionState(korrekturBerechnen, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="auth-form">
      <input type="hidden" name="id" value={vorgang.id} />
      <label className="field">
        <span>Abweichender Beginn nur für diesen Vorgang</span>
        <input type="date" name="beginn" defaultValue={vorgang.korrektur?.beginn ?? ""} />
        <Hinweis>
          Die Mitgliedsstammdaten bleiben unverändert. Leer lassen und speichern entfernt die Korrektur. Die Stammdaten ändern Sie bei Bedarf separat
          unter „Mitglieds- und Tätigkeitszeiten“.
        </Hinweis>
      </label>
      <label className="field">
        <span>Begründung</span>
        <input name="aenderungs_begruendung" placeholder="z. B. Abweichende Tätigkeitszeit laut Vereinsunterlagen" />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton variante="sekundaer">Mit Korrektur neu berechnen</SendenButton>
    </form>
  );
}

export function ZuruecksetzenFormular({ vorgang }: { vorgang: Vorgang }) {
  const [ergebnis, aktion] = useActionState(zuruecksetzen, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={vorgang.id} />
      <input name="aenderungs_begruendung" placeholder="Begründung (optional)" className="min-h-10 rounded-xl border border-brand-line px-3 text-[13px]" />
      <Meldung ergebnis={ergebnis} />
      <SendenButton variante="sekundaer" laedtText="Wird zurückgesetzt …">
        <RotateCcw size={15} /> Auf automatische Berechnung zurücksetzen
      </SendenButton>
    </form>
  );
}

export function VorgangLoeschen({ vorgangId, zurueck }: { vorgangId: string; zurueck: string }) {
  const [laeuft, starten] = useTransition();
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>(LEERES_ERGEBNIS);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={laeuft}
        className={`${KNOPF_KLEIN} text-brand-red`}
        onClick={() => {
          if (!confirm("Diesen Vorgang wirklich löschen? Die Historie des Vorgangs wird mit gelöscht.")) return;
          starten(async () => {
            const e = await vorgangLoeschen(vorgangId);
            setErgebnis(e);
            if (!e.error) router.push(zurueck);
          });
        }}
      >
        <Trash2 size={15} /> Vorgang löschen
      </button>
      <Meldung ergebnis={ergebnis} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
export function ManuelleEhrung({
  vereinId,
  mitglieder,
  arten,
  vorbelegt,
}: {
  vereinId: string;
  mitglieder: { vmId: string; name: string }[];
  arten: Auszeichnung[];
  vorbelegt?: string;
}) {
  const [ergebnis, aktion] = useActionState(ehrungManuellAnlegen, LEERES_ERGEBNIS);
  const [status, setStatus] = useState("vorgemerkt");
  return (
    <form action={aktion} className="auth-form">
      <input type="hidden" name="verein_id" value={vereinId} />
      <label className="field">
        <span>Mitglied</span>
        <select name="vereins_mitglied_id" defaultValue={vorbelegt ?? ""} required>
          <option value="" disabled>
            Bitte auswählen
          </option>
          {mitglieder.map((m) => (
            <option key={m.vmId} value={m.vmId}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Auszeichnung</span>
        <select name="ehrungsart_id" defaultValue="" required>
          <option value="" disabled>
            Bitte auswählen
          </option>
          {artenOptionen(arten.filter((a) => a.aktiv))}
        </select>
      </label>
      <label className="field">
        <span>Grund</span>
        <textarea name="grundlage_text" required className={TEXTFELD} placeholder="z. B. Besondere Verdienste im Verein" />
      </label>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Status</span>
          <select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="moeglich">{STATUS.moeglich.zeichen} Möglich</option>
            <option value="geprueft">{STATUS.geprueft.zeichen} Geprüft</option>
            <option value="vorgemerkt">{STATUS.vorgemerkt.zeichen} Vorgemerkt</option>
            <option value="verliehen">{STATUS.verliehen.zeichen} Bereits verliehen (Altbestand)</option>
          </select>
        </label>
        {status === "verliehen" ? (
          <label className="field">
            <span>Verliehen am</span>
            <input type="date" name="verliehen_am" required />
          </label>
        ) : (
          <label className="field">
            <span>Datum / voraussichtlich</span>
            <input type="date" name="faellig_am" />
          </label>
        )}
      </div>
      {status === "verliehen" && (
        <label className="field">
          <span>Verliehen durch (optional)</span>
          <input name="verliehen_durch" />
        </label>
      )}
      <label className="field">
        <span>Interne Notiz (optional)</span>
        <textarea name="interne_notiz" className={TEXTFELD} />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton>Ehrung anlegen</SendenButton>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------
export function ZeitraumFormular({ vereinId, vmId, zeitraum }: { vereinId: string; vmId: string; zeitraum?: Zeitraum }) {
  const [ergebnis, aktion] = useActionState(zeitraumSpeichern, LEERES_ERGEBNIS);
  const [art, setArt] = useState<string>(zeitraum?.art ?? "mitgliedschaft");
  return (
    <form action={aktion} className="grid grid-cols-1 gap-3 sm:grid-cols-[1.1fr_1fr_1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="verein_id" value={vereinId} />
      <input type="hidden" name="vereins_mitglied_id" value={vmId} />
      {zeitraum && <input type="hidden" name="id" value={zeitraum.id} />}
      <label className="field">
        <span>Art</span>
        <select name="art" value={art} onChange={(e) => setArt(e.target.value)}>
          {Object.entries(ZEITRAUM_ART).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Funktion</span>
        <input name="funktion" list="ehrungs-funktionen" defaultValue={zeitraum?.funktion ?? ""} disabled={art !== "funktion"} placeholder={art === "funktion" ? "z. B. Trainer" : "–"} />
      </label>
      <label className="field">
        <span>Von</span>
        <input type="date" name="von" defaultValue={zeitraum?.von ?? ""} required />
      </label>
      <label className="field">
        <span>Bis (leer = heute)</span>
        <input type="date" name="bis" defaultValue={zeitraum?.bis ?? ""} />
      </label>
      <SendenButton variante={zeitraum ? "sekundaer" : "primaer"}>{zeitraum ? "Speichern" : "Hinzufügen"}</SendenButton>
      <div className="sm:col-span-5">
        <Meldung ergebnis={ergebnis} />
      </div>
    </form>
  );
}

export function ZeitraumLoeschen({ zeitraumId }: { zeitraumId: string }) {
  const [laeuft, starten] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Zeitraum löschen"
      disabled={laeuft}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-red-wash hover:text-brand-red disabled:opacity-50"
      onClick={() => {
        if (!confirm("Diesen Zeitraum löschen?")) return;
        starten(async () => {
          await zeitraumLoeschen(zeitraumId);
          router.refresh();
        });
      }}
    >
      <Trash2 size={15} />
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
export function AuszeichnungFormular({ vereinId, art, vorlage }: { vereinId: string; art?: Auszeichnung; vorlage?: Partial<Auszeichnung> }) {
  const [ergebnis, aktion] = useActionState(auszeichnungSpeichern, LEERES_ERGEBNIS);
  const w = { ...vorlage, ...art };
  return (
    <form action={aktion} className="auth-form">
      <input type="hidden" name="verein_id" value={vereinId} />
      {art && <input type="hidden" name="id" value={art.id} />}
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Name</span>
          <input name="name" defaultValue={w.name ?? ""} required placeholder="z. B. Vereinsnadel Silber" />
        </label>
        <label className="field sm:max-w-[160px]">
          <span>Kurzbezeichnung</span>
          <input name="kurz" defaultValue={w.kurz ?? ""} />
        </label>
      </div>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Serie (für mehrstufige Auszeichnungen)</span>
          <input name="serie" defaultValue={w.serie ?? ""} placeholder="z. B. Vereinsnadel" />
        </label>
        <label className="field">
          <span>Stufe</span>
          <input name="stufe" defaultValue={w.stufe ?? ""} placeholder="z. B. Silber" />
        </label>
        <label className="field sm:max-w-[120px]">
          <span>Stufen-Nr.</span>
          <input name="stufe_nr" inputMode="numeric" defaultValue={w.stufeNr ?? ""} placeholder="1, 2, 3" />
        </label>
      </div>
      <Hinweis>Stufen derselben Serie werden aufsteigend nach Stufen-Nr. behandelt: vorgeschlagen wird die höchste erreichte und die nächste Stufe.</Hinweis>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Kategorie</span>
          <input name="kategorie" defaultValue={w.kategorie ?? ""} placeholder="z. B. Jubiläum, Trainer, Jugend" />
        </label>
        <label className="field sm:max-w-[120px]">
          <span>Symbol</span>
          <input name="symbol" defaultValue={w.symbol ?? ""} placeholder="🏅" />
        </label>
      </div>
      <label className="field">
        <span>Beschreibung</span>
        <textarea name="beschreibung" defaultValue={w.beschreibung ?? ""} className={TEXTFELD} />
      </label>
      <label className="field">
        <span>Voraussetzungen (Text)</span>
        <textarea name="voraussetzungen" defaultValue={w.voraussetzungen ?? ""} className={TEXTFELD} placeholder="z. B. 10 Jahre Mitgliedschaft" />
      </label>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Mehrere Regeln</span>
          <select name="regel_verknuepfung" defaultValue={w.regelVerknuepfung ?? "eine"}>
            <option value="eine">Eine Regel genügt</option>
            <option value="alle">Alle Regeln müssen erfüllt sein</option>
          </select>
        </label>
        <label className="field">
          <span>Prüfstatus</span>
          <select name="pruefstatus" defaultValue={w.pruefstatus ?? "geprueft"}>
            {Object.entries(PRUEFSTATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.zeichen} {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-2 text-[13.5px] text-brand-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="automatische_vorschlaege" value="ja" defaultChecked={w.automatischeVorschlaege ?? true} className="h-4 w-4 accent-brand-red" />
          Automatische Vorschläge anhand der Regeln
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="bestellung_erforderlich" value="ja" defaultChecked={w.bestellungErforderlich ?? true} className="h-4 w-4 accent-brand-red" />
          Bestellung erforderlich (z. B. Nadel, Orden – nicht bei Ehrenmitgliedschaft oder Dankesurkunde)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="aktiv" value="ja" defaultChecked={w.aktiv ?? true} className="h-4 w-4 accent-brand-red" />
          Aktiv
        </label>
      </div>
      <label className="field">
        <span>Bemerkung</span>
        <textarea name="bemerkung" defaultValue={w.bemerkung ?? ""} className={TEXTFELD} />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton>{art ? "Auszeichnung speichern" : "Auszeichnung anlegen"}</SendenButton>
    </form>
  );
}

const MIT_JAHREN = ["mitgliedschaft", "aktiv", "ehrenamt", "funktion"];
const alsText = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
let zeilenZaehler = 0;

// Punkte je Jahr: feste Kriterien + beliebig viele Aemter/Funktionen
function GewichteFelder({ gewichte }: { gewichte: Record<string, number> | null }) {
  const [aemter, setAemter] = useState(() => {
    const start = Object.entries(gewichte ?? {})
      .filter(([k]) => k.startsWith("funktion:"))
      .map(([k, v]) => ({ nr: ++zeilenZaehler, name: k.slice(9), wert: alsText(v) }));
    return start.length ? start : [{ nr: ++zeilenZaehler, name: "", wert: "" }];
  });
  return (
    <>
      <p className="text-[12.5px] font-semibold text-brand-ink-soft">Punkte je vollendetem Jahr</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["mitgliedschaft", "Mitgliedschaft", "0"],
            ["aktiv", "Aktive Tätigkeit", "z. B. 0,5"],
            ["ehrenamt", "Ehrenamt", "0"],
          ] as const
        ).map(([k, label, platzhalter]) => (
          <label key={k} className="field">
            <span>{label}</span>
            <input name={`gewicht_${k}`} inputMode="decimal" defaultValue={alsText(gewichte?.[k])} placeholder={platzhalter} />
          </label>
        ))}
      </div>
      <p className="text-[12.5px] font-semibold text-brand-ink-soft">Ämter / Funktionen</p>
      <div className="flex flex-col gap-2">
        {aemter.map((z) => (
          <div key={z.nr} className="flex items-end gap-2">
            <label className="field flex-1">
              <span>Bezeichnung</span>
              <input name="funktion_name" defaultValue={z.name} list="ehrungs-funktionen" placeholder="z. B. Vorstand" />
            </label>
            <label className="field w-[110px]">
              <span>Punkte/Jahr</span>
              <input name="funktion_punkte" inputMode="decimal" defaultValue={z.wert} placeholder="z. B. 1" />
            </label>
            <button
              type="button"
              aria-label="Amt entfernen"
              onClick={() => setAemter((a) => a.filter((x) => x.nr !== z.nr))}
              className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-red-wash hover:text-brand-red"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setAemter((a) => [...a, { nr: ++zeilenZaehler, name: "", wert: "" }])} className={`${KNOPF_KLEIN} self-start`}>
          <Plus size={14} /> Amt hinzufügen
        </button>
      </div>
      <Hinweis>
        Punkte aus mehreren Kriterien werden addiert. Die Bezeichnung muss mit der Funktion in den Tätigkeitszeiten übereinstimmen (Groß-/Kleinschreibung egal).
      </Hinweis>
    </>
  );
}

// Eingabefelder einer Regel (Werte vorbelegt)
function RegelFelder({ berechnung, regel }: { berechnung: string; regel?: Regel | null }) {
  return (
    <>
      {MIT_JAHREN.includes(berechnung) && (
        <div className="field-row flex-wrap">
          <label className="field sm:max-w-[160px]">
            <span>Erforderliche Jahre</span>
            <input name="jahre" inputMode="decimal" required defaultValue={alsText(regel?.jahre)} placeholder="z. B. 10" />
          </label>
          {berechnung === "funktion" && (
            <label className="field">
              <span>Funktion</span>
              <input name="funktion" required defaultValue={regel?.funktion ?? ""} list="ehrungs-funktionen" placeholder="z. B. Trainer, Vorstand" />
            </label>
          )}
          <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-brand-ink">
            <input type="checkbox" name="ununterbrochen" value="ja" defaultChecked={regel?.ununterbrochen ?? false} className="h-4 w-4 accent-brand-red" />{" "}
            ununterbrochen
          </label>
        </div>
      )}
      {berechnung === "punkte" && (
        <>
          <label className="field sm:max-w-[200px]">
            <span>Mindestpunkte</span>
            <input name="punkte_min" inputMode="decimal" required defaultValue={alsText(regel?.punkteMin)} placeholder="z. B. 11" />
          </label>
          <GewichteFelder gewichte={regel?.punkteGewichte ?? null} />
        </>
      )}
      <label className="field">
        <span>Bemerkung (optional)</span>
        <input name="bemerkung" defaultValue={regel?.bemerkung ?? ""} />
      </label>
    </>
  );
}

// Regel anlegen oder (mit regel) bearbeiten
export function RegelFormular({ artId, regel }: { artId: string; regel?: Regel }) {
  const [ergebnis, aktion] = useActionState(regelSpeichern, LEERES_ERGEBNIS);
  const [berechnung, setBerechnung] = useState<string>(regel?.berechnung ?? "mitgliedschaft");
  return (
    <form action={aktion} className="auth-form rounded-xl border border-dashed border-brand-line p-3">
      <input type="hidden" name="ehrungsart_id" value={artId} />
      {regel && <input type="hidden" name="id" value={regel.id} />}
      <label className="field">
        <span>Berechnungsart</span>
        <select name="berechnung" value={berechnung} onChange={(e) => setBerechnung(e.target.value)}>
          {Object.entries(BERECHNUNG).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <RegelFelder key={berechnung} berechnung={berechnung} regel={regel?.berechnung === berechnung ? regel : null} />
      <Meldung ergebnis={ergebnis} />
      <SendenButton variante="sekundaer">{regel ? "Regel speichern" : "Regel hinzufügen"}</SendenButton>
    </form>
  );
}

// Verbandsregel fuer den eigenen Verein anpassen (vorbelegt mit den aktuell wirksamen Werten)
export function RegelAnpassung({ vereinId, basis, anpassung }: { vereinId: string; basis: Regel; anpassung: Anpassung | null }) {
  const [ergebnis, aktion] = useActionState(regelAnpassen, LEERES_ERGEBNIS);
  const wirksam = wirksameRegel(basis, anpassung);
  return (
    <form action={aktion} className="auth-form rounded-xl border border-dashed border-brand-line p-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      <input type="hidden" name="regel_id" value={basis.id} />
      <p className="text-[12.5px] text-brand-ink-soft">
        Berechnungsart: <strong className="text-brand-ink">{BERECHNUNG[basis.berechnung]}</strong> · Voreinstellung: {regelKurz(basis)}
      </p>
      <label className="flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
        <input type="checkbox" name="anwenden" value="ja" defaultChecked={anpassung?.aktiv ?? true} className="h-4 w-4 accent-brand-red" />
        Regel für unseren Verein anwenden
      </label>
      {basis.berechnung !== "manuell" && <RegelFelder berechnung={basis.berechnung} regel={wirksam} />}
      <Meldung ergebnis={ergebnis} />
      <SendenButton variante="sekundaer">Für unseren Verein speichern</SendenButton>
    </form>
  );
}

export function AnpassungZuruecksetzen({ vereinId, regelId }: { vereinId: string; regelId: string }) {
  const [laeuft, starten] = useTransition();
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>(LEERES_ERGEBNIS);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={laeuft}
        className={`${KNOPF_KLEIN} self-start`}
        onClick={() => {
          if (!confirm("Anpassung verwerfen und die Voreinstellung aus dem Katalog verwenden?")) return;
          starten(async () => {
            const e = await regelAnpassungZuruecksetzen(vereinId, regelId);
            setErgebnis(e);
            if (!e.error) router.refresh();
          });
        }}
      >
        <RotateCcw size={14} /> Auf Voreinstellung zurücksetzen
      </button>
      <Meldung ergebnis={ergebnis} />
    </div>
  );
}

// Vorschlagsliste fuer Funktionsbezeichnungen (einmal je Seite einbinden)
export function FunktionsListe({ namen }: { namen: string[] }) {
  return (
    <datalist id="ehrungs-funktionen">
      {namen.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );
}

export function RegelLoeschen({ regelId }: { regelId: string }) {
  const [laeuft, starten] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Regel löschen"
      disabled={laeuft}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-red-wash hover:text-brand-red"
      onClick={() => {
        if (!confirm("Diese Regel entfernen? Bereits verliehene Ehrungen bleiben unverändert.")) return;
        starten(async () => {
          await regelLoeschen(regelId);
          router.refresh();
        });
      }}
    >
      <Trash2 size={14} />
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
export function OrganisationenFormular({ vereinId, organisationen }: { vereinId: string; organisationen: Organisation[] }) {
  const [ergebnis, aktion] = useActionState(organisationenSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      {organisationen.length === 0 && <p className="text-[13px] text-brand-ink-soft">Es sind noch keine Verbände hinterlegt.</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {organisationen.map((o) => (
          <label key={o.id} className="flex items-start gap-2 rounded-xl border border-brand-line p-2.5 text-[13.5px] text-brand-ink">
            <input type="checkbox" name="organisation" value={o.id} defaultChecked={o.gewaehlt} className="mt-0.5 h-4 w-4 accent-brand-red" />
            <span className="min-w-0">
              <span className="font-semibold">
                {TYP.verband.zeichen} {o.name}
                {o.kuerzel ? ` (${o.kuerzel})` : ""}
              </span>
              <span className="block text-[12px] text-brand-ink-soft">
                {o.anzahlAuszeichnungen} Auszeichnung{o.anzahlAuszeichnungen === 1 ? "" : "en"} ·{" "}
                {PRUEFSTATUS[o.pruefstatus as keyof typeof PRUEFSTATUS]?.zeichen} {PRUEFSTATUS[o.pruefstatus as keyof typeof PRUEFSTATUS]?.label}
              </span>
            </span>
          </label>
        ))}
      </div>
      <Meldung ergebnis={ergebnis} />
      {organisationen.length > 0 && <SendenButton>Auswahl speichern</SendenButton>}
    </form>
  );
}


// ---------------------------------------------------------------------------------------------
// Schnellaktionen in der Kandidatenliste: Pruefen, Vormerken, Ignorieren
export function SchnellAktionen({ vorgangId }: { vorgangId: string }) {
  const [laeuft, starten] = useTransition();
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>(LEERES_ERGEBNIS);
  const router = useRouter();
  const setzen = (status: Status) =>
    starten(async () => {
      const fd = new FormData();
      fd.set("id", vorgangId);
      fd.set("status", status);
      const e = await statusSetzen(LEERES_ERGEBNIS, fd);
      setErgebnis(e);
      if (!e.error) router.refresh();
    });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={laeuft} onClick={() => setzen("geprueft")} className={KNOPF_KLEIN}>
          🔍 Geprüft
        </button>
        <button type="button" disabled={laeuft} onClick={() => setzen("vorgemerkt")} className={KNOPF_KLEIN}>
          🔵 Vormerken
        </button>
        <button type="button" disabled={laeuft} onClick={() => setzen("nicht_vorgesehen")} className={KNOPF_KLEIN}>
          ⚪ Ignorieren
        </button>
      </div>
      <Meldung ergebnis={ergebnis} />
    </div>
  );
}
