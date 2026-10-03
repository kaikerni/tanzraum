"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Printer, Save, Send } from "lucide-react";
import { antragAbsenden, antragZwischenspeichern } from "@/app/dashboard/mitgliedsantrag/actions";
import { antragDatenBearbeiten } from "@/app/dashboard/mitgliedsantraege/actions";
import {
  benoetigteUnterschriften,
  FELD_LABEL,
  ibanGueltig,
  minderjaehrig,
  mitVerein,
  pruefeAntrag,
  UNTERSCHRIFT_LABEL,
  VERFAHREN_LABEL,
  type AntragDaten,
  type AntragInhalt,
  type FeldSchluessel,
  type Unterschriften,
  type Verfahren,
} from "@/lib/antraege/vorlage";
import { UnterschriftFeld } from "./UnterschriftFeld";

const KARTE = "rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5";
const EINGABE = "w-full rounded-lg border border-brand-line bg-white px-3 py-2.5 text-[14px] text-brand-ink outline-none focus:border-brand-red";
const TEXT = "whitespace-pre-line rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] leading-relaxed text-brand-ink";

const VERFAHREN_TEXT: Record<Verfahren, string> = {
  bildschirm: "Du unterschreibst direkt hier mit Finger, Maus oder Stift. Die Unterschrift erscheint mit Datum und Uhrzeit im PDF.",
  bestaetigung: "Du trägst deinen Namen ein und bestätigst die Angaben mit einem Häkchen.",
  papier: "Du schickst die Angaben ab, druckst das PDF aus, unterschreibst es und gibst es beim Verein ab oder lädst es hier hoch.",
  extern: "Du schickst die Angaben ab. Die Aufnahme läuft danach über das Verfahren des Vereins (z. B. persönlich oder über die Vereinswebseite).",
  bestehend: "Du bist bereits Mitglied und bestätigst nur deine Mitgliedschaft.",
};

function Feld({ label, pflicht, children }: { label: string; pflicht?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
      <span>
        {label}
        {pflicht && <span className="text-brand-red"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className={`${KARTE} flex flex-col gap-3`}>
      <h2 className="text-[16px] font-bold text-brand-ink">{titel}</h2>
      {children}
    </section>
  );
}

export function AntragFormular({
  antragId,
  modus,
  vereinName,
  logoUrl,
  inhalt,
  start,
  erlaubteVerfahren,
  heute,
  bestehendErlaubt = false,
  externText = "",
  externLink = "",
}: {
  antragId: string;
  modus: "antrag" | "verwaltung";
  vereinName: string;
  logoUrl: string | null;
  inhalt: AntragInhalt;
  start: AntragDaten;
  erlaubteVerfahren: Verfahren[];
  heute: string;
  bestehendErlaubt?: boolean;
  externText?: string;
  externLink?: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<AntragDaten>(start);
  const [verfahren, setVerfahren] = useState<Verfahren | "">(erlaubteVerfahren.length === 1 ? erlaubteVerfahren[0] : "");
  const [unterschriften, setUnterschriften] = useState<Unterschriften>({});
  // Bereits Mitglied: nur Bestaetigung statt vollstaendigem Antrag (wenn der Verein das erlaubt)
  const [bestehend, setBestehend] = useState(bestehendErlaubt && start.bestehend_bestaetigt);
  const [meldung, setMeldung] = useState<{ fehler?: string; ok?: string }>({});
  const [fertig, setFertig] = useState<string | null>(null);
  const [laeuft, starten] = useTransition();
  const verwaltung = modus === "verwaltung";

  const setze = <K extends keyof AntragDaten>(k: K, w: AntragDaten[K]) => setD((x) => ({ ...x, [k]: w }));
  const minderj = minderjaehrig(d.geburtsdatum, heute);
  const benoetigt = useMemo(() => benoetigteUnterschriften(inhalt, d, heute), [inhalt, d, heute]);
  const v = (t: string) => mitVerein(t, vereinName);
  const ibanOk = d.sepa_iban.length === 0 || ibanGueltig(d.sepa_iban);

  function unterschriftSetzen(rolle: keyof Unterschriften, wert: { bild?: string; name?: string }) {
    setUnterschriften((u) => ({ ...u, [rolle]: { ...wert, zeitpunkt: new Date().toISOString() } }));
  }

  function zwischenspeichern(danach?: () => void) {
    starten(async () => {
      const r = verwaltung ? await antragDatenBearbeiten(antragId, d) : await antragZwischenspeichern(antragId, d);
      setMeldung(r.error ? { fehler: r.error } : { ok: r.ok ?? "Gespeichert." });
      if (!r.error) {
        router.refresh();
        danach?.();
      }
    });
  }

  function drucken() {
    // Zuerst speichern, damit das PDF den aktuellen Stand zeigt
    const fenster = window.open("about:blank", "_blank");
    zwischenspeichern(() => {
      if (fenster) fenster.location.href = `/api/mitgliedsantrag/pdf?antrag=${antragId}`;
    });
  }

  function absenden() {
    const art: Verfahren | "" = bestehend ? "bestehend" : verfahren;
    const erlaubt: Verfahren[] = bestehendErlaubt ? [...erlaubteVerfahren, "bestehend"] : erlaubteVerfahren;
    const fehler = pruefeAntrag(inhalt, d, art, unterschriften, heute, erlaubt);
    if (fehler) {
      setMeldung({ fehler });
      return;
    }
    starten(async () => {
      const r = await antragAbsenden(antragId, d, art, bestehend ? {} : unterschriften);
      if (r.error) {
        setMeldung({ fehler: r.error });
        return;
      }
      setFertig(r.versand ?? "app");
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    });
  }

  if (fertig) {
    return (
      <section className={`${KARTE} flex flex-col items-center gap-3 py-8 text-center`}>
        <CheckCircle2 size={40} className="text-brand-green" />
        <p className="text-[18px] font-bold text-brand-ink">{bestehend ? "Deine Mitgliedschaft ist bestätigt." : "Dein Mitgliedsantrag ist abgeschickt."}</p>
        <p className="max-w-md text-[14px] text-brand-ink-soft">
          {vereinName} prüft deinen Antrag und meldet sich bei dir.
          {fertig === "verein" && " Der Verein hat ihn zusätzlich als PDF per E-Mail erhalten."}
          {!bestehend && verfahren === "extern" && " Die Aufnahme läuft über das Verfahren des Vereins."}
          {!bestehend && verfahren === "papier" && " Bitte drucke das PDF aus, unterschreibe es und gib es beim Verein ab – oder lade es auf der nächsten Seite hoch."}
        </p>
        <a href={`/api/mitgliedsantrag/pdf?antrag=${antragId}`} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
          <Printer size={16} /> PDF ansehen / drucken
        </a>
      </section>
    );
  }

  const feld = (k: FeldSchluessel, typ = "text") =>
    inhalt.felder[k] === "aus" ? null : (
      <Feld key={k} label={FELD_LABEL[k]} pflicht={inhalt.felder[k] === "pflicht"}>
        <input type={typ} value={d[k] as string} onChange={(e) => setze(k, e.target.value.slice(0, 80) as never)} className={EINGABE} />
      </Feld>
    );

  return (
    <div className="flex flex-col gap-4">
      <section className={`${KARTE} flex items-start justify-between gap-4`}>
        <div className="min-w-0">
          <p className="text-[22px] font-extrabold leading-tight text-brand-ink">{inhalt.titel}</p>
          <p className="text-[13px] text-brand-ink-soft">zum</p>
          <p className="text-[19px] font-bold leading-tight text-brand-ink">{vereinName}</p>
          {inhalt.anschrift && <p className="text-[13px] text-brand-ink-soft">{inhalt.anschrift}</p>}
        </div>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-contain" />
        )}
      </section>

      {!verwaltung && bestehendErlaubt && (
        <section className={`${KARTE} flex flex-col gap-3`}>
          <h2 className="text-[16px] font-bold text-brand-ink">Neu im Verein oder schon Mitglied?</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { wert: false, titel: "Ich möchte Mitglied werden", text: "Mitgliedsantrag ausfüllen und absenden." },
              { wert: true, titel: `Ich bin bereits Mitglied bei ${vereinName}`, text: "Nur bestätigen – kein neuer Antrag nötig." },
            ].map((o) => (
              <label
                key={String(o.wert)}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 ${bestehend === o.wert ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white"}`}
              >
                <input type="radio" name="art" checked={bestehend === o.wert} onChange={() => setBestehend(o.wert)} className="sr-only" />
                <span className="text-[13.5px] font-semibold text-brand-ink">{o.titel}</span>
                <span className="text-[12px] text-brand-ink-soft">{o.text}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {bestehend && !verwaltung ? (
        <Abschnitt titel="Bestehende Mitgliedschaft bestätigen">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Feld label="Vorname" pflicht>
              <input value={d.vorname} onChange={(e) => setze("vorname", e.target.value.slice(0, 80))} className={EINGABE} />
            </Feld>
            <Feld label="Nachname" pflicht>
              <input value={d.nachname} onChange={(e) => setze("nachname", e.target.value.slice(0, 80))} className={EINGABE} />
            </Feld>
            <Feld label="E-Mail" pflicht>
              <input type="email" value={d.email} onChange={(e) => setze("email", e.target.value.slice(0, 200))} className={EINGABE} />
            </Feld>
            <Feld label="Mitglied seit (optional)">
              <input value={d.mitglied_seit} onChange={(e) => setze("mitglied_seit", e.target.value.slice(0, 40))} placeholder="z. B. 2019" className={EINGABE} />
            </Feld>
          </div>
          <label className="flex items-start gap-2.5 text-[13.5px] text-brand-ink">
            <input
              type="checkbox"
              checked={d.bestehend_bestaetigt}
              onChange={(e) => setze("bestehend_bestaetigt", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#e11d2e]"
            />
            <span>Ich bestätige, dass ich bereits Mitglied bei {vereinName} bin. Der Verein prüft die Angabe und nimmt mich in TanzRaum auf.</span>
          </label>
        </Abschnitt>
      ) : (
        <>
        {inhalt.mitgliedsarten.length > 0 && (
          <Abschnitt titel="Art der Mitgliedschaft">
            <div className="flex flex-wrap gap-2">
              {inhalt.mitgliedsarten.map((a) => (
                <label
                  key={a.name}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-[13.5px] font-semibold ${d.mitgliedsart === a.name ? "border-brand-red bg-brand-red-wash text-brand-red-deep" : "border-brand-line text-brand-ink"}`}
                >
                  <input type="radio" name="mitgliedsart" checked={d.mitgliedsart === a.name} onChange={() => setze("mitgliedsart", a.name)} className="sr-only" />
                  {a.name}
                </label>
              ))}
            </div>
            {inhalt.mitgliedsarten.find((a) => a.name === d.mitgliedsart)?.betrag && (
              <Feld label="Förderbeitrag (jährlich)" pflicht>
                <input value={d.foerderbeitrag} onChange={(e) => setze("foerderbeitrag", e.target.value.slice(0, 30))} placeholder="z. B. 50 €" className={`${EINGABE} max-w-xs`} />
              </Feld>
            )}
          </Abschnitt>
        )}

        {(inhalt.abteilungen.length > 0 || inhalt.abteilung_sonstige) && (
          <Abschnitt titel="Gruppe / Abteilung">
            <div className="flex flex-wrap gap-2">
              {inhalt.abteilungen.map((a) => (
                <label key={a} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-brand-line px-3 text-[13.5px] text-brand-ink has-[:checked]:border-brand-red has-[:checked]:bg-brand-red-wash">
                  <input
                    type="checkbox"
                    checked={d.abteilungen.includes(a)}
                    onChange={(e) => setze("abteilungen", e.target.checked ? [...d.abteilungen, a] : d.abteilungen.filter((x) => x !== a))}
                    className="h-4 w-4 accent-[#e11d2e]"
                  />
                  {a}
                </label>
              ))}
            </div>
            {inhalt.abteilung_sonstige && (
              <Feld label="Sonstige">
                <input value={d.abteilung_sonstige} onChange={(e) => setze("abteilung_sonstige", e.target.value.slice(0, 80))} className={`${EINGABE} max-w-sm`} />
              </Feld>
            )}
          </Abschnitt>
        )}

        <Abschnitt titel="Angaben zur Person">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Feld label="Vorname" pflicht>
              <input value={d.vorname} onChange={(e) => setze("vorname", e.target.value.slice(0, 80))} autoComplete="given-name" className={EINGABE} />
            </Feld>
            <Feld label="Name" pflicht>
              <input value={d.nachname} onChange={(e) => setze("nachname", e.target.value.slice(0, 80))} autoComplete="family-name" className={EINGABE} />
            </Feld>
            <Feld label="Straße und Hausnummer" pflicht>
              <input value={d.strasse} onChange={(e) => setze("strasse", e.target.value.slice(0, 120))} autoComplete="street-address" className={EINGABE} />
            </Feld>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <Feld label="PLZ" pflicht>
                <input value={d.plz} onChange={(e) => setze("plz", e.target.value.slice(0, 10))} inputMode="numeric" autoComplete="postal-code" className={EINGABE} />
              </Feld>
              <Feld label="Ort" pflicht>
                <input value={d.ort} onChange={(e) => setze("ort", e.target.value.slice(0, 80))} autoComplete="address-level2" className={EINGABE} />
              </Feld>
            </div>
            <Feld label="Geburtsdatum" pflicht>
              <input type="date" value={d.geburtsdatum} max={heute} onChange={(e) => setze("geburtsdatum", e.target.value)} className={EINGABE} />
            </Feld>
            <Feld label="E-Mail" pflicht>
              <input type="email" value={d.email} onChange={(e) => setze("email", e.target.value.slice(0, 200))} autoComplete="email" className={EINGABE} />
            </Feld>
            {feld("telefon", "tel")}
            {feld("handy", "tel")}
            {feld("telefon_geschaeftlich", "tel")}
            {feld("fax", "tel")}
            {feld("beruf")}
            {feld("nationalitaet")}
          </div>
        </Abschnitt>

        {(minderj || d.sorgeberechtigte.length > 0) && (
          <Abschnitt titel="Sorgeberechtigte">
            <p className="text-[13px] text-brand-ink">{v(inhalt.text_minderjaehrige)}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1].map((n) => (
                <Feld key={n} label={`Name, Vorname (Sorgeberechtigte/r ${n + 1})`} pflicht={n === 0 && minderj}>
                  <input
                    value={d.sorgeberechtigte[n]?.name ?? ""}
                    onChange={(e) => {
                      const liste = [d.sorgeberechtigte[0]?.name ?? "", d.sorgeberechtigte[1]?.name ?? ""];
                      liste[n] = e.target.value.slice(0, 120);
                      setze("sorgeberechtigte", liste.filter((x) => x.trim()).map((name) => ({ name })));
                    }}
                    className={EINGABE}
                  />
                </Feld>
              ))}
            </div>
          </Abschnitt>
        )}

        <Abschnitt titel="Beitrag, Satzung und Datenschutz">
          {inhalt.text_beitrag && <p className={TEXT}>{v(inhalt.text_beitrag)}</p>}
          {inhalt.text_haftung && <p className={`${TEXT} italic`}>{v(inhalt.text_haftung)}</p>}
          {inhalt.text_datenschutz && <p className={`${TEXT} text-brand-ink-soft`}>{v(inhalt.text_datenschutz)}</p>}
        </Abschnitt>

        {inhalt.sepa_aktiv && (
          <Abschnitt titel="SEPA-Lastschriftmandat">
            <p className="text-[12.5px] font-semibold text-brand-ink">
              Gläubiger-Identifikationsnummer {inhalt.glaeubiger_id || "–"} · Mandatsreferenz wird separat mitgeteilt · {inhalt.sepa_zahlungsart}
            </p>
            <p className={TEXT}>{v(inhalt.text_sepa)}</p>
            <label className="flex items-start gap-2.5 text-[13.5px] font-semibold text-brand-ink">
              <input type="checkbox" checked={d.sepa_erteilt} onChange={(e) => setze("sepa_erteilt", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#e11d2e]" />
              Ich erteile dieses SEPA-Lastschriftmandat.
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Feld label="Kontoinhaber(in)" pflicht>
                <input value={d.sepa_kontoinhaber} onChange={(e) => setze("sepa_kontoinhaber", e.target.value.slice(0, 120))} className={EINGABE} />
                <span className="flex flex-wrap gap-2 font-normal">
                  {d.vorname && d.nachname && (
                    <button type="button" onClick={() => setze("sepa_kontoinhaber", `${d.vorname} ${d.nachname}`)} className="text-[12px] font-semibold text-brand-red">
                      wie Mitglied
                    </button>
                  )}
                  {d.sorgeberechtigte.map((s, n) => (
                    <button key={n} type="button" onClick={() => setze("sepa_kontoinhaber", s.name)} className="text-[12px] font-semibold text-brand-red">
                      wie Sorgeberechtigte/r {n + 1}
                    </button>
                  ))}
                </span>
              </Feld>
              <Feld label="Kreditinstitut">
                <input value={d.sepa_bank} onChange={(e) => setze("sepa_bank", e.target.value.slice(0, 120))} className={EINGABE} />
              </Feld>
              <Feld label="Straße und Hausnummer (falls abweichend)">
                <input value={d.sepa_strasse} onChange={(e) => setze("sepa_strasse", e.target.value.slice(0, 120))} className={EINGABE} />
              </Feld>
              <Feld label="PLZ und Ort (falls abweichend)">
                <input value={d.sepa_plz_ort} onChange={(e) => setze("sepa_plz_ort", e.target.value.slice(0, 120))} className={EINGABE} />
              </Feld>
              <Feld label="IBAN" pflicht>
                <input
                  value={d.sepa_iban}
                  onChange={(e) => setze("sepa_iban", e.target.value.replace(/\s+/g, "").toUpperCase().slice(0, 34))}
                  autoComplete="off"
                  className={`${EINGABE} ${ibanOk ? "" : "border-brand-red"}`}
                />
                {!ibanOk && d.sepa_iban.length >= 15 && <span className="font-normal text-brand-red">Diese IBAN ist nicht gültig.</span>}
              </Feld>
              <Feld label="BIC">
                <input value={d.sepa_bic} onChange={(e) => setze("sepa_bic", e.target.value.replace(/\s+/g, "").toUpperCase().slice(0, 11))} className={EINGABE} />
              </Feld>
            </div>
          </Abschnitt>
        )}

        {inhalt.foto_aktiv && (
          <Abschnitt titel="Einwilligung zur Verwendung von Fotos">
            <p className={TEXT}>{v(inhalt.text_foto)}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["ja", "Ja, ich willige ein"],
                  ["nein", "Nein, ich willige nicht ein"],
                ] as const
              ).map(([w, l]) => (
                <label
                  key={w}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-[13.5px] font-semibold ${d.foto === w ? "border-brand-red bg-brand-red-wash text-brand-red-deep" : "border-brand-line text-brand-ink"}`}
                >
                  <input type="radio" name="foto" checked={d.foto === w} onChange={() => setze("foto", w)} className="sr-only" />
                  {l}
                </label>
              ))}
            </div>
          </Abschnitt>
        )}

        {!verwaltung && (
          <Abschnitt titel="Bestätigen und unterschreiben">
            <label className="flex items-start gap-2.5 text-[13.5px] text-brand-ink">
              <input type="checkbox" checked={d.bestaetigt} onChange={(e) => setze("bestaetigt", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#e11d2e]" />
              <span>
                Ich habe die Angaben geprüft und die Texte oben gelesen. Ich beantrage die Mitgliedschaft im Verein <strong>{vereinName}</strong>
                {minderj ? " – als bzw. mit Zustimmung der Sorgeberechtigten" : ""}.
              </span>
            </label>
            <Feld label="Ort">
              <input value={d.unterschrift_ort} onChange={(e) => setze("unterschrift_ort", e.target.value.slice(0, 80))} placeholder="z. B. Landau" className={`${EINGABE} max-w-xs`} />
            </Feld>

            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] font-semibold text-brand-ink-soft">Wie möchtest du unterschreiben?</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {erlaubteVerfahren.map((w) => (
                  <label
                    key={w}
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 ${verfahren === w ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white"}`}
                  >
                    <input type="radio" name="verfahren" checked={verfahren === w} onChange={() => setVerfahren(w)} className="sr-only" />
                    <span className="text-[13.5px] font-semibold text-brand-ink">{VERFAHREN_LABEL[w]}</span>
                    <span className="text-[12px] text-brand-ink-soft">{VERFAHREN_TEXT[w]}</span>
                  </label>
                ))}
              </div>
            </div>

            {verfahren === "bildschirm" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {benoetigt.map((rolle) => (
                  <UnterschriftFeld
                    key={rolle}
                    label={`Unterschrift ${UNTERSCHRIFT_LABEL[rolle]}${rolle === "sorge1" || rolle === "sorge2" ? ` – ${d.sorgeberechtigte[rolle === "sorge1" ? 0 : 1]?.name ?? ""}` : rolle === "kontoinhaber" ? ` – ${d.sepa_kontoinhaber}` : ""}`}
                    wert={unterschriften[rolle]?.bild}
                    onChange={(bild) => (bild ? unterschriftSetzen(rolle, { bild }) : setUnterschriften((u) => ({ ...u, [rolle]: undefined })))}
                  />
                ))}
              </div>
            )}
            {verfahren === "bestaetigung" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {benoetigt.map((rolle) => (
                  <Feld key={rolle} label={`${UNTERSCHRIFT_LABEL[rolle]}: Name zur Bestätigung`} pflicht>
                    <input value={unterschriften[rolle]?.name ?? ""} onChange={(e) => unterschriftSetzen(rolle, { name: e.target.value.slice(0, 120) })} className={EINGABE} />
                  </Feld>
                ))}
              </div>
            )}
            {verfahren === "extern" && (
              <div className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink">
                <p className="whitespace-pre-line">{externText || `Nach dem Absenden meldet sich ${vereinName} mit den weiteren Schritten.`}</p>
                {externLink && (
                  <a href={externLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex font-semibold text-brand-red">
                    Zum Verfahren des Vereins →
                  </a>
                )}
              </div>
            )}
            {verfahren === "papier" && (
              <p className="rounded-xl bg-brand-gold-wash px-3.5 py-3 text-[13px] text-brand-ink">
                Nach dem Absenden kannst du das PDF ausdrucken, unterschreiben und beim Verein abgeben oder als Foto/Scan hochladen.
              </p>
            )}
          </Abschnitt>
        )}
        </>
      )}

      <div className="sticky bottom-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-line bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        {meldung.fehler && <p className="form-error w-full">{meldung.fehler}</p>}
        {meldung.ok && <p className="w-full text-[13px] text-brand-green">{meldung.ok}</p>}
        <button type="button" disabled={laeuft} onClick={drucken} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-60" title="Speichern und als PDF öffnen">
          <Printer size={16} /> Drucken
        </button>
        <button type="button" disabled={laeuft} onClick={() => zwischenspeichern()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-60">
          <Save size={16} /> {verwaltung ? "Änderungen speichern" : "Zwischenspeichern"}
        </button>
        {!verwaltung && (
          <button type="button" disabled={laeuft} onClick={absenden} className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-60">
            <Send size={16} /> {laeuft ? "Wird gesendet …" : bestehend ? "Mitgliedschaft bestätigen" : "Antrag absenden"}
          </button>
        )}
      </div>
    </div>
  );
}
