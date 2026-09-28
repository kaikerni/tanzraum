"use client";

import { useState, useTransition } from "react";
import { FileText, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { vorlageSpeichern } from "@/app/dashboard/mitgliedsantraege/actions";
import {
  FELD_LABEL,
  STANDARD_INHALT,
  VERFAHREN_LABEL,
  type AntragEinstellungen,
  type AntragInhalt,
  type Benachrichtigung,
  type FeldSchluessel,
  type FeldStatus,
  type Verfahren,
} from "@/lib/antraege/vorlage";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";

const KARTE = "rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5";
const EINGABE = "w-full rounded-lg border border-brand-line bg-white px-3 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-red";
const KNOPF = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg";

function Abschnitt({ titel, hinweis, children }: { titel: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <section className={`${KARTE} flex flex-col gap-3`}>
      <div>
        <h2 className="text-[16px] font-bold text-brand-ink">{titel}</h2>
        {hinweis && <p className="text-[12.5px] text-brand-ink-soft">{hinweis}</p>}
      </div>
      {children}
    </section>
  );
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
      {label}
      {children}
    </label>
  );
}

function Schalter({ an, setAn, label, text }: { an: boolean; setAn: (w: boolean) => void; label: string; text?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px] text-brand-ink">
      <input type="checkbox" checked={an} onChange={(e) => setAn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#e11d2e]" />
      <span>
        <span className="font-semibold">{label}</span>
        {text && <span className="block text-[12.5px] text-brand-ink-soft">{text}</span>}
      </span>
    </label>
  );
}

function Textfeld({
  label,
  wert,
  setWert,
  standard,
  zeilen = 4,
  max = 3000,
}: {
  label: string;
  wert: string;
  setWert: (w: string) => void;
  standard?: string;
  zeilen?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-brand-ink-soft">{label}</span>
        {standard !== undefined && wert !== standard && (
          <button type="button" onClick={() => setWert(standard)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-ink-soft hover:text-brand-red">
            <RotateCcw size={12} /> Beispieltext
          </button>
        )}
      </div>
      <textarea value={wert} onChange={(e) => setWert(e.target.value.slice(0, max))} rows={zeilen} className={EINGABE} />
    </div>
  );
}

const BENACHRICHTIGUNG: [Benachrichtigung, string][] = [
  ["app_email", "TanzRaum-Benachrichtigung und E-Mail"],
  ["app", "Nur TanzRaum-Benachrichtigung"],
  ["keine", "Keine Benachrichtigung"],
];

export function VorlageEditor({
  vereinId,
  vereinName,
  hatLogo,
  logoPasst,
  gruppen,
  start,
  startEinstellungen,
}: {
  vereinId: string;
  vereinName: string;
  hatLogo: boolean;
  logoPasst: boolean;
  gruppen: string[];
  start: AntragInhalt;
  startEinstellungen: AntragEinstellungen;
}) {
  const [inhalt, setInhalt] = useState<AntragInhalt>(start);
  const [einst, setEinst] = useState<AntragEinstellungen>(startEinstellungen);
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>({ error: null });
  const [geaendert, setGeaendert] = useState(false);
  const [laeuft, starten] = useTransition();
  const [neueAbteilung, setNeueAbteilung] = useState("");

  const i = <K extends keyof AntragInhalt>(k: K, w: AntragInhalt[K]) => {
    setInhalt((x) => ({ ...x, [k]: w }));
    setGeaendert(true);
  };
  const e = <K extends keyof AntragEinstellungen>(k: K, w: AntragEinstellungen[K]) => {
    setEinst((x) => ({ ...x, [k]: w }));
    setGeaendert(true);
  };

  function speichern() {
    starten(async () => {
      const r = await vorlageSpeichern(vereinId, inhalt, einst);
      setErgebnis(r);
      if (!r.error) setGeaendert(false);
    });
  }

  const verfahrenUmschalten = (v: Verfahren, an: boolean) => {
    const neu = an ? [...new Set([...einst.verfahren, v])] : einst.verfahren.filter((x) => x !== v);
    if (neu.length === 0) return;
    e("verfahren", neu);
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      <Abschnitt titel="Grundeinstellungen" hinweis="So läuft die Aufnahme neuer Mitglieder in eurem Verein ab.">
        <Schalter
          an={einst.antrag_erforderlich}
          setAn={(w) => e("antrag_erforderlich", w)}
          label="Neue Personen füllen einen Mitgliedsantrag aus"
          text="Hinzugefügte Personen sind „neu“, bis ihr den Antrag annehmt. Ohne Antrag werden sie sofort Mitglied."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Feld label="E-Mail-Adresse für eingehende Anträge (PDF)">
            <input
              type="email"
              value={einst.empfaenger_email}
              onChange={(x) => e("empfaenger_email", x.target.value.slice(0, 200))}
              placeholder="z. B. mitglieder@verein.de"
              className={EINGABE}
            />
          </Feld>
          <div className="flex items-end">
            <Schalter an={einst.kopie_an_antragsteller} setAn={(w) => e("kopie_an_antragsteller", w)} label="Kopie als PDF an die antragstellende Person" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-semibold text-brand-ink-soft">Zulässige Unterschriftsverfahren</span>
          {(Object.keys(VERFAHREN_LABEL) as Verfahren[]).map((v) => (
            <label key={v} className="flex items-center gap-2.5 text-[13.5px] text-brand-ink">
              <input type="checkbox" checked={einst.verfahren.includes(v)} onChange={(x) => verfahrenUmschalten(v, x.target.checked)} className="h-4 w-4 accent-[#e11d2e]" />
              {VERFAHREN_LABEL[v]}
            </label>
          ))}
          <p className="rounded-lg bg-brand-gold-wash px-3 py-2 text-[12px] text-brand-ink">
            Hinweis: TanzRaum bildet das gewählte Verfahren ab, garantiert aber nicht, dass eine elektronische Unterschrift für jeden Zweck
            ausreicht – insbesondere für ein SEPA-Lastschriftmandat entscheidet ihr bzw. euer Kreditinstitut.
          </p>
        </div>
      </Abschnitt>

      <Abschnitt titel="Kopf des Formulars" hinweis={`Erscheint oben auf dem Antrag von ${vereinName}.`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Feld label="Überschrift">
            <input value={inhalt.titel} onChange={(x) => i("titel", x.target.value.slice(0, 80))} className={EINGABE} />
          </Feld>
          <Feld label="Anschrift des Vereins">
            <input value={inhalt.anschrift} onChange={(x) => i("anschrift", x.target.value.slice(0, 300))} placeholder="Straße, PLZ Ort" className={EINGABE} />
          </Feld>
        </div>
        <Textfeld label="Kontakt (Telefon, E-Mail, Webseite – je Zeile)" wert={inhalt.kontakt} setWert={(w) => i("kontakt", w)} zeilen={3} max={300} />
        <Feld label="Leitspruch (Fußzeile, optional)">
          <input value={inhalt.slogan} onChange={(x) => i("slogan", x.target.value.slice(0, 120))} placeholder="z. B. Die Karnevalsgesellschaft von …" className={EINGABE} />
        </Feld>
        <p className="text-[12.5px] text-brand-ink-soft">
          Logo: {hatLogo ? (logoPasst ? "Euer Vereinslogo wird oben rechts eingefügt." : "Euer Logo ist kein PNG/JPG – bitte unter „Mein Verein“ ein PNG- oder JPG-Logo hochladen, damit es im PDF erscheint.") : "Noch kein Vereinslogo – unter „Mein Verein“ hochladen (PNG oder JPG)."}
        </p>
      </Abschnitt>

      <Abschnitt titel="Vorstand und Vereinsangaben" hinweis="Erscheinen in der Fußzeile jeder Seite.">
        {inhalt.vorstand.map((v, n) => (
          <div key={n} className="grid grid-cols-1 gap-2 rounded-xl border border-brand-line p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input value={v.funktion} onChange={(x) => i("vorstand", inhalt.vorstand.map((y, m) => (m === n ? { ...y, funktion: x.target.value.slice(0, 60) } : y)))} placeholder="Funktion, z. B. Präsident" className={EINGABE} />
            <input value={v.name} onChange={(x) => i("vorstand", inhalt.vorstand.map((y, m) => (m === n ? { ...y, name: x.target.value.slice(0, 80) } : y)))} placeholder="Name" className={EINGABE} />
            <button type="button" onClick={() => i("vorstand", inhalt.vorstand.filter((_, m) => m !== n))} className={KNOPF} aria-label="Entfernen">
              <Trash2 size={14} />
            </button>
            <textarea value={v.anschrift} onChange={(x) => i("vorstand", inhalt.vorstand.map((y, m) => (m === n ? { ...y, anschrift: x.target.value.slice(0, 160) } : y)))} placeholder="Anschrift (optional)" rows={2} className={EINGABE} />
            <textarea value={v.kontakt} onChange={(x) => i("vorstand", inhalt.vorstand.map((y, m) => (m === n ? { ...y, kontakt: x.target.value.slice(0, 160) } : y)))} placeholder="Telefon/E-Mail (optional)" rows={2} className={EINGABE} />
          </div>
        ))}
        {inhalt.vorstand.length < 8 && (
          <button type="button" onClick={() => i("vorstand", [...inhalt.vorstand, { funktion: "", name: "", anschrift: "", kontakt: "" }])} className={`${KNOPF} w-fit`}>
            <Plus size={14} /> Vorstandsmitglied
          </button>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Feld label="Vorstand nach § 26 BGB">
            <input value={inhalt.vorstand_26} onChange={(x) => i("vorstand_26", x.target.value.slice(0, 300))} placeholder="Vorstand (§26 BGB): …" className={EINGABE} />
          </Feld>
          <Feld label="Registereintrag">
            <input value={inhalt.register} onChange={(x) => i("register", x.target.value.slice(0, 120))} placeholder="VR 1234 Amtsgericht …" className={EINGABE} />
          </Feld>
          <Feld label="Steuernummer">
            <input value={inhalt.steuernummer} onChange={(x) => i("steuernummer", x.target.value.slice(0, 60))} className={EINGABE} />
          </Feld>
        </div>
      </Abschnitt>

      <Abschnitt titel="Bankverbindungen" hinweis="Z. B. Vereinskonto und Spendenkonto – erscheinen in der Fußzeile.">
        {inhalt.bankverbindungen.map((b, n) => (
          <div key={n} className="grid grid-cols-1 gap-2 rounded-xl border border-brand-line p-3 sm:grid-cols-[1fr_1fr_1.4fr_0.8fr_auto]">
            <input value={b.bezeichnung} onChange={(x) => i("bankverbindungen", inhalt.bankverbindungen.map((y, m) => (m === n ? { ...y, bezeichnung: x.target.value.slice(0, 60) } : y)))} placeholder="z. B. Spendenkonto" className={EINGABE} />
            <input value={b.bank} onChange={(x) => i("bankverbindungen", inhalt.bankverbindungen.map((y, m) => (m === n ? { ...y, bank: x.target.value.slice(0, 80) } : y)))} placeholder="Bank" className={EINGABE} />
            <input value={b.iban} onChange={(x) => i("bankverbindungen", inhalt.bankverbindungen.map((y, m) => (m === n ? { ...y, iban: x.target.value.slice(0, 42) } : y)))} placeholder="IBAN" className={EINGABE} />
            <input value={b.bic} onChange={(x) => i("bankverbindungen", inhalt.bankverbindungen.map((y, m) => (m === n ? { ...y, bic: x.target.value.slice(0, 15) } : y)))} placeholder="BIC" className={EINGABE} />
            <button type="button" onClick={() => i("bankverbindungen", inhalt.bankverbindungen.filter((_, m) => m !== n))} className={KNOPF} aria-label="Entfernen">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {inhalt.bankverbindungen.length < 4 && (
          <button type="button" onClick={() => i("bankverbindungen", [...inhalt.bankverbindungen, { bezeichnung: "", bank: "", iban: "", bic: "" }])} className={`${KNOPF} w-fit`}>
            <Plus size={14} /> Bankverbindung
          </button>
        )}
      </Abschnitt>

      <Abschnitt titel="Art der Mitgliedschaft" hinweis="Die antragstellende Person wählt eine davon. Bei „Betrag abfragen“ kann sie einen Beitrag eintragen (z. B. Förderbeitrag).">
        {inhalt.mitgliedsarten.map((a, n) => (
          <div key={n} className="flex flex-wrap items-center gap-2">
            <input value={a.name} onChange={(x) => i("mitgliedsarten", inhalt.mitgliedsarten.map((y, m) => (m === n ? { ...y, name: x.target.value.slice(0, 60) } : y)))} className={`${EINGABE} max-w-xs`} />
            <label className="flex items-center gap-2 text-[13px] text-brand-ink">
              <input type="checkbox" checked={a.betrag} onChange={(x) => i("mitgliedsarten", inhalt.mitgliedsarten.map((y, m) => (m === n ? { ...y, betrag: x.target.checked } : y)))} className="h-4 w-4 accent-[#e11d2e]" />
              Betrag abfragen
            </label>
            <button type="button" onClick={() => i("mitgliedsarten", inhalt.mitgliedsarten.filter((_, m) => m !== n))} className={KNOPF} aria-label="Entfernen">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {inhalt.mitgliedsarten.length < 8 && (
          <button type="button" onClick={() => i("mitgliedsarten", [...inhalt.mitgliedsarten, { name: "", betrag: false }])} className={`${KNOPF} w-fit`}>
            <Plus size={14} /> Mitgliedsart
          </button>
        )}
      </Abschnitt>

      <Abschnitt titel="Gruppen und Abteilungen zum Ankreuzen" hinweis="Z. B. Minigarde, Juniorengarde, Männerballett – die Person kreuzt an, wo sie mitmachen möchte.">
        <div className="flex flex-wrap gap-2">
          {inhalt.abteilungen.map((a) => (
            <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-brand-bg px-3 py-1.5 text-[13px] text-brand-ink">
              {a}
              <button type="button" onClick={() => i("abteilungen", inhalt.abteilungen.filter((x) => x !== a))} aria-label={`${a} entfernen`} className="text-brand-ink-soft hover:text-brand-red">
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={neueAbteilung}
            onChange={(x) => setNeueAbteilung(x.target.value.slice(0, 60))}
            onKeyDown={(x) => {
              if (x.key === "Enter") {
                x.preventDefault();
                const w = neueAbteilung.trim();
                if (w && !inhalt.abteilungen.includes(w) && inhalt.abteilungen.length < 30) i("abteilungen", [...inhalt.abteilungen, w]);
                setNeueAbteilung("");
              }
            }}
            placeholder="Neue Gruppe/Abteilung + Enter"
            className={`${EINGABE} max-w-xs`}
          />
          {gruppen.length > 0 && (
            <button type="button" onClick={() => i("abteilungen", [...new Set([...inhalt.abteilungen, ...gruppen])].slice(0, 30))} className={KNOPF}>
              Gruppen des Vereins übernehmen
            </button>
          )}
        </div>
        <Schalter an={inhalt.abteilung_sonstige} setAn={(w) => i("abteilung_sonstige", w)} label="„Sonstige“ mit Freitextfeld anbieten" />
      </Abschnitt>

      <Abschnitt titel="Angaben zur Person" hinweis="Name, Anschrift, Geburtsdatum und E-Mail werden immer abgefragt. Bitte nur erfragen, was ihr für die Mitgliedschaft wirklich braucht.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(FELD_LABEL) as FeldSchluessel[]).map((k) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-xl border border-brand-line px-3 py-2 text-[13.5px] text-brand-ink">
              {FELD_LABEL[k]}
              <select
                value={inhalt.felder[k]}
                onChange={(x) => i("felder", { ...inhalt.felder, [k]: x.target.value as FeldStatus })}
                className="rounded-lg border border-brand-line bg-white px-2 py-1.5 text-[13px]"
              >
                <option value="aus">nicht abfragen</option>
                <option value="optional">freiwillig</option>
                <option value="pflicht">Pflichtfeld</option>
              </select>
            </label>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt titel="Texte im Antrag" hinweis="Feste Texte, die die Person vor dem Absenden liest und bestätigt. {verein} wird durch euren Vereinsnamen ersetzt.">
        <Textfeld label="Beitrag und Satzung" wert={inhalt.text_beitrag} setWert={(w) => i("text_beitrag", w)} standard={STANDARD_INHALT.text_beitrag} />
        <Textfeld label="Haftung und Vereinsordnungen" wert={inhalt.text_haftung} setWert={(w) => i("text_haftung", w)} standard={STANDARD_INHALT.text_haftung} />
        <Textfeld label="Hinweis für Minderjährige" wert={inhalt.text_minderjaehrige} setWert={(w) => i("text_minderjaehrige", w)} standard={STANDARD_INHALT.text_minderjaehrige} zeilen={2} max={500} />
        <Textfeld label="Datenschutzhinweis" wert={inhalt.text_datenschutz} setWert={(w) => i("text_datenschutz", w)} standard={STANDARD_INHALT.text_datenschutz} />
      </Abschnitt>

      <Abschnitt titel="SEPA-Lastschriftmandat">
        <Schalter an={inhalt.sepa_aktiv} setAn={(w) => i("sepa_aktiv", w)} label="Lastschriftmandat im Antrag abfragen" />
        {inhalt.sepa_aktiv && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Feld label="Gläubiger-Identifikationsnummer">
                <input value={inhalt.glaeubiger_id} onChange={(x) => i("glaeubiger_id", x.target.value.slice(0, 35))} placeholder="DE98ZZZ09999999999" className={EINGABE} />
              </Feld>
              <Feld label="Zahlungsart">
                <input value={inhalt.sepa_zahlungsart} onChange={(x) => i("sepa_zahlungsart", x.target.value.slice(0, 60))} className={EINGABE} />
              </Feld>
            </div>
            <Textfeld label="Mandatstext" wert={inhalt.text_sepa} setWert={(w) => i("text_sepa", w)} standard={STANDARD_INHALT.text_sepa} zeilen={5} />
          </>
        )}
      </Abschnitt>

      <Abschnitt titel="Einwilligung Fotos">
        <Schalter an={inhalt.foto_aktiv} setAn={(w) => i("foto_aktiv", w)} label="Einwilligung zur Verwendung von Fotos abfragen" text="Die Person entscheidet frei mit „Ja“ oder „Nein“." />
        {inhalt.foto_aktiv && <Textfeld label="Einwilligungstext" wert={inhalt.text_foto} setWert={(w) => i("text_foto", w)} standard={STANDARD_INHALT.text_foto} zeilen={6} max={4000} />}
        <Schalter an={inhalt.vereinsfelder} setAn={(w) => i("vereinsfelder", w)} label="Felder „Mitgliedsnummer / Familiennummer“ (vom Verein auszufüllen) im PDF" />
      </Abschnitt>

      <Abschnitt titel="Benachrichtigungen" hinweis="Was passiert beim Hinzufügen, bei der Annahme und bei der Ablehnung. {verein} = Vereinsname.">
        {(
          [
            ["hinzufuegen_benachrichtigung", "hinzufuegen_text", "Beim Hinzufügen einer Person"],
            ["annahme_benachrichtigung", "annahme_text", "Bei Annahme des Antrags"],
            ["ablehnung_benachrichtigung", "ablehnung_text", "Bei Ablehnung des Antrags"],
          ] as const
        ).map(([art, text, titel]) => (
          <div key={art} className="flex flex-col gap-2 rounded-xl border border-brand-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13.5px] font-semibold text-brand-ink">{titel}</span>
              <select value={einst[art]} onChange={(x) => e(art, x.target.value as Benachrichtigung)} className="rounded-lg border border-brand-line bg-white px-2 py-1.5 text-[13px]">
                {BENACHRICHTIGUNG.map(([w, l]) => (
                  <option key={w} value={w}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {einst[art] !== "keine" && <textarea value={einst[text]} onChange={(x) => e(text, x.target.value.slice(0, 500))} rows={2} className={EINGABE} />}
            {art === "annahme_benachrichtigung" && (
              <>
                <Schalter an={einst.auto_freischalten} setAn={(w) => e("auto_freischalten", w)} label="Person bei Annahme automatisch für den Vereinsbereich freischalten" text="Sonst schaltet ihr sie später unter „Mitglieder“ frei." />
                <Schalter an={einst.aufnahme_pdf_speichern} setAn={(w) => e("aufnahme_pdf_speichern", w)} label="Aufnahmedokument als PDF erzeugen und speichern" text="Für euch und für das Mitglied abrufbar." />
              </>
            )}
          </div>
        ))}
      </Abschnitt>

      <div className="fixed bottom-20 left-3 right-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-line bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4 md:left-auto md:right-6 md:w-auto">
        <Meldung ergebnis={ergebnis} />
        {geaendert && <span className="text-[12.5px] text-brand-ink-soft">Ungespeicherte Änderungen</span>}
        <a href={`/api/mitgliedsantrag/pdf?muster=${vereinId}`} target="_blank" rel="noopener" className={KNOPF} title="Zeigt den zuletzt gespeicherten Stand">
          <Printer size={14} /> Muster-PDF
        </a>
        <button type="button" disabled={laeuft} onClick={speichern} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-60">
          <FileText size={15} /> {laeuft ? "Wird gespeichert …" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
