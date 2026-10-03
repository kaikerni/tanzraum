"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileUp, Loader2, Users } from "lucide-react";
import { importAusfuehren, importPruefen, type ImportErgebnis, type ImportGruppe, type ImportKontoHinweis, type ImportTreffer } from "@/app/dashboard/mitglieder/actions";
import { leseTabelle, TabellenFehler, type Tabelle } from "@/lib/mitglieder/tabelle";
import { automatischZuordnen, dateiDuplikate, FELD, FELDER, zeilenAufbereiten, type FeldGruppe, type FeldKey, type Hinweis, type ImportZeile } from "@/lib/mitglieder/importFelder";

type Schritt = "datei" | "daten" | "spalten" | "gruppen" | "vorschau" | "fertig";
type Entscheidung = "vorhanden" | "neu";

const KARTE = "rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-6";
const KNOPF_HAUPT = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-red px-5 text-[15px] font-bold text-white hover:bg-brand-red-deep disabled:opacity-50";
const KNOPF_NEBEN = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-line bg-white px-5 text-[15px] font-semibold text-brand-ink hover:bg-brand-bg";
const GRUPPEN_TITEL: Record<FeldGruppe, string> = { persoenlich: "Persönliche Daten", verein: "Vereinsdaten", gruppen: "Gruppen" };
const TREFFER_TEXT: Record<ImportTreffer["treffer"], string> = { email: "gleiche E-Mail-Adresse", mitgliedsnummer: "gleiche Mitgliedsnummer", name: "gleicher Vor- und Nachname" };

function zahl(n: number, eins: string, mehr: string) {
  return `${n} ${n === 1 ? eins : mehr}`;
}

function datumDe(iso?: string) {
  if (!iso) return "";
  const [j, m, d] = iso.split("-");
  return `${d}.${m}.${j}`;
}

function wertText(k: FeldKey, w?: string) {
  if (!w) return "–";
  return k === "geburtsdatum" || k === "eintrittsdatum" ? datumDe(w) : w;
}

export function MitgliederImport({
  vereinId,
  vereinName,
  gruppen,
  altersklassen,
}: {
  vereinId: string;
  vereinName: string;
  gruppen: { id: string; name: string }[];
  altersklassen: string[];
}) {
  const [schritt, setSchritt] = useState<Schritt>("datei");
  const [dateiName, setDateiName] = useState("");
  const [tabelle, setTabelle] = useState<Tabelle | null>(null);
  const [zuordnung, setZuordnung] = useState<(FeldKey | null)[]>([]);
  const [auswahl, setAuswahl] = useState<Set<FeldKey>>(new Set());
  const [gruppenWahl, setGruppenWahl] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [treffer, setTreffer] = useState<Map<number, ImportTreffer> | null>(null);
  const [kontoHinweise, setKontoHinweise] = useState<ImportKontoHinweis[]>([]);
  const [entscheidung, setEntscheidung] = useState<Record<number, Entscheidung>>({});
  const [uebernehmen, setUebernehmen] = useState<Record<number, boolean>>({});
  const [alleTreffer, setAlleTreffer] = useState(false);
  const [ergebnis, setErgebnis] = useState<ImportErgebnis | null>(null);

  const vorhanden = useMemo(() => new Set(zuordnung.filter((z): z is FeldKey => !!z)), [zuordnung]);
  const gruppeAktiv = auswahl.has("gruppe") && vorhanden.has("gruppe");

  // Nur ausgewaehlte, zugeordnete Felder – alles andere bleibt im Browser
  const aufbereitet = useMemo(() => {
    if (!tabelle) return { daten: [] as (ImportZeile & { quelle: number })[], hinweise: [] as Hinweis[], doppelt: new Set<number>() };
    const r = zeilenAufbereiten(tabelle.zeilen, zuordnung, auswahl);
    return { ...r, doppelt: dateiDuplikate(r.daten) };
  }, [tabelle, zuordnung, auswahl]);

  const gruppenInDatei = useMemo(() => {
    const m = new Map<string, number>();
    if (!gruppeAktiv) return m;
    for (const d of aufbereitet.daten) if (d.gruppe) m.set(d.gruppe, (m.get(d.gruppe) ?? 0) + 1);
    return new Map([...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "de")));
  }, [aufbereitet, gruppeAktiv]);

  const namensOk = (auswahl.has("vorname") && auswahl.has("nachname") && vorhanden.has("vorname") && vorhanden.has("nachname")) || (auswahl.has("name") && vorhanden.has("name"));
  const schritte: Schritt[] = ["datei", "daten", "spalten", ...(gruppeAktiv ? (["gruppen"] as Schritt[]) : []), "vorschau"];
  const nummer = schritte.indexOf(schritt) + 1;

  async function dateiGewaehlt(f: File | undefined) {
    if (!f) return;
    setFehler(null);
    setLaeuft(true);
    try {
      const t = await leseTabelle(f);
      const z = automatischZuordnen(t.kopf);
      setTabelle(t);
      setDateiName(f.name);
      setZuordnung(z);
      setAuswahl(new Set(z.filter((k): k is FeldKey => !!k && FELD[k].standard)));
      setSchritt("daten");
    } catch (e) {
      setFehler(e instanceof TabellenFehler ? e.message : "Die Datei konnte nicht gelesen werden. Bitte speichere sie als CSV (UTF-8) oder .xlsx.");
    } finally {
      setLaeuft(false);
    }
  }

  function feldUmschalten(k: FeldKey, an: boolean) {
    setAuswahl((alt) => {
      const neu = new Set(alt);
      if (an) neu.add(k);
      else neu.delete(k);
      return neu;
    });
  }

  function gruppenVorbelegen() {
    const wahl: Record<string, string> = {};
    for (const name of gruppenInDatei.keys()) {
      const passend = gruppen.find((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase());
      const istAltersklasse = altersklassen.some((a) => a.toLowerCase() === name.trim().toLowerCase());
      wahl[name] = gruppenWahl[name] ?? (passend ? passend.id : istAltersklasse ? "keine" : "neu");
    }
    setGruppenWahl(wahl);
  }

  async function zurVorschau() {
    setSchritt("vorschau");
    setTreffer(null);
    setFehler(null);
    setLaeuft(true);
    const zeilen = aufbereitet.daten.map(({ quelle: _q, ...d }) => d);
    const r = await importPruefen(vereinId, zeilen);
    setLaeuft(false);
    if (r.error) return setFehler(r.error);
    const m = new Map((r.treffer ?? []).map((t) => [t.idx, t]));
    setKontoHinweise(r.kontoHinweise ?? []);
    setTreffer(m);
    setEntscheidung(Object.fromEntries([...m.keys()].map((i) => [i, "vorhanden" as Entscheidung])));
    setUebernehmen({});
  }

  const sichtbareTreffer = treffer ? [...treffer.values()].filter((t) => !aufbereitet.doppelt.has(t.idx)) : [];
  const zuImportieren = aufbereitet.daten.map((d, i) => ({ d, i })).filter(({ i }) => !aufbereitet.doppelt.has(i));
  const anzahlVorhanden = zuImportieren.filter(({ i }) => treffer?.has(i) && entscheidung[i] === "vorhanden").length;
  const anzahlNeu = zuImportieren.length - anzahlVorhanden;
  const anzahlAenderung = zuImportieren.filter(({ i }) => {
    const t = treffer?.get(i);
    return t && entscheidung[i] === "vorhanden" && Object.keys(t.aenderungen).length > 0;
  }).length;

  async function importieren() {
    setFehler(null);
    setLaeuft(true);
    const zeilen = zuImportieren.map(({ d, i }) => {
      const { quelle: _q, ...rest } = d;
      const z: Record<string, unknown> = { ...rest };
      if (!gruppeAktiv || !d.gruppe || gruppenWahl[d.gruppe] === "keine") delete z.gruppe;
      const t = treffer?.get(i);
      if (t && entscheidung[i] === "vorhanden") Object.assign(z, { aktion: "vorhanden", ziel_art: t.zielArt, ziel_id: t.zielId, uebernehmen: !!uebernehmen[i] });
      else z.aktion = "neu";
      return z;
    });
    let gruppenAuftrag: Record<string, ImportGruppe> | null = null;
    if (gruppeAktiv) {
      gruppenAuftrag = {};
      for (const [name, w] of Object.entries(gruppenWahl)) {
        gruppenAuftrag[name] = w === "neu" ? { aktion: "neu" } : w === "keine" ? { aktion: "keine" } : { aktion: "vorhanden", gruppe_id: w };
      }
    }
    const r = await importAusfuehren(vereinId, zeilen, gruppenAuftrag);
    setLaeuft(false);
    if (r.error || !r.ergebnis) return setFehler(r.error ?? "Der Import hat nicht geklappt.");
    setErgebnis(r.ergebnis);
    setSchritt("fertig");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const zurueck = () => {
    const i = schritte.indexOf(schritt);
    setFehler(null);
    if (i > 0) setSchritt(schritte[i - 1]);
  };

  // ── Darstellung ────────────────────────────────────────────────────────────────────────────────────
  const fortschritt = schritt !== "fertig" && (
    <div className="flex items-center gap-3">
      {schritt !== "datei" && (
        <button type="button" onClick={zurueck} aria-label="Zurück" className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-brand-bg">
          <ArrowLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-brand-ink-soft">
          Schritt {nummer} von {schritte.length}
          {dateiName && schritt !== "datei" ? ` · ${dateiName}` : ""}
        </p>
        <div className="mt-1.5 flex gap-1">
          {schritte.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i < nummer ? "bg-brand-red" : "bg-brand-line"}`} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {fortschritt}

      {schritt === "datei" && (
        <section className={KARTE}>
          <h2 className="text-[20px] font-extrabold text-brand-ink">Mitglieder importieren</h2>
          <div className="mt-2 flex flex-col gap-2 text-[14.5px] leading-relaxed text-brand-ink">
            <p>Du kannst deine vorhandene Mitgliederliste aus einer anderen Vereinsverwaltung übernehmen.</p>
            <p>Exportiere deine Mitglieder dafür zunächst aus deiner bisherigen Vereinssoftware als CSV- oder Excel-Datei und lade sie anschließend hier hoch.</p>
            <p className="rounded-xl bg-brand-bg px-3.5 py-2.5 text-[13.5px]">
              Deine Mitglieder werden dadurch <strong>nicht automatisch bei TanzRaum registriert</strong>. Zunächst werden nur die Vereinsmitglieder übernommen. Anschließend kannst du ihnen eine Einladung zu TanzRaum schicken.
            </p>
          </div>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-line bg-brand-bg/40 px-4 py-8 text-center hover:border-brand-red">
            {laeuft ? <Loader2 size={28} className="animate-spin text-brand-red" /> : <FileUp size={28} className="text-brand-red" />}
            <span className="text-[15px] font-bold text-brand-ink">{laeuft ? "Datei wird gelesen …" : "Datei auswählen"}</span>
            <span className="text-[12.5px] text-brand-ink-soft">CSV oder Excel (.xlsx) · erste Zeile mit Spaltennamen</span>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                void dateiGewaehlt(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-3 text-[12.5px] text-brand-ink-soft">
            Die Datei wird zunächst nur in deinem Browser gelesen. Es wird noch nichts gespeichert – du wählst im nächsten Schritt selbst aus, welche Daten übernommen werden.
          </p>
        </section>
      )}

      {schritt === "daten" && tabelle && (
        <section className={KARTE}>
          <h2 className="text-[20px] font-extrabold text-brand-ink">Welche Daten möchtest du übernehmen?</h2>
          <p className="mt-1 text-[13.5px] text-brand-ink-soft">
            {zahl(tabelle.zeilen.length, "Zeile", "Zeilen")} und {zahl(tabelle.kopf.length, "Spalte", "Spalten")} gefunden. Angezeigt werden nur Daten, die in deiner Datei vorhanden sind.
          </p>
          {(["persoenlich", "verein", "gruppen"] as FeldGruppe[]).map((gr) => {
            const felder = FELDER.filter((f) => f.gruppe === gr && vorhanden.has(f.key));
            if (felder.length === 0) return null;
            return (
              <fieldset key={gr} className="mt-5">
                <legend className="text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-brand-ink-soft">{GRUPPEN_TITEL[gr]}</legend>
                {gr === "persoenlich" && (
                  <p className="mt-2 rounded-xl bg-brand-gold-wash px-3.5 py-2.5 text-[13px] leading-relaxed text-brand-ink">
                    <span>
                      🔒 Übernimm nur die Daten, die dein Verein in TanzRaum benötigt. Persönliche Angaben wie Adresse, Telefonnummer oder Geburtsdatum werden nicht automatisch übernommen. Du entscheidest vor dem Import, welche Felder übernommen werden.
                    </span>
                  </p>
                )}
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {felder.map((f) => (
                    <label key={f.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-brand-line px-3 py-2 hover:bg-brand-bg/60">
                      <input type="checkbox" checked={auswahl.has(f.key)} onChange={(e) => feldUmschalten(f.key, e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--color-brand-red,#e11d2e)]" />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-brand-ink">{f.key === "gruppe" ? "Gruppenzuordnung übernehmen" : f.label}</span>
                        <span className="block truncate text-[12px] text-brand-ink-soft">aus Spalte „{tabelle.kopf[zuordnung.indexOf(f.key)]}“</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
          {vorhanden.size === 0 && <p className="mt-4 rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px]">Es wurden keine Spalten automatisch erkannt. Ordne sie im nächsten Schritt selbst zu.</p>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setSchritt("spalten")} className={KNOPF_HAUPT}>
              Weiter: Spalten prüfen
            </button>
          </div>
        </section>
      )}

      {schritt === "spalten" && tabelle && (
        <section className={KARTE}>
          <h2 className="text-[20px] font-extrabold text-brand-ink">Spalten prüfen</h2>
          <p className="mt-1 text-[13.5px] text-brand-ink-soft">
            Ordne jeder Spalte deiner Datei das passende TanzRaum-Feld zu. Was du nicht brauchst, bleibt auf „Nicht importieren“ – diese Daten werden nicht übernommen.
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {tabelle.kopf.map((kopf, i) => {
              const beispiele = tabelle.zeilen.map((z) => z[i]).filter(Boolean).slice(0, 3);
              const feld = zuordnung[i];
              return (
                <li key={i} className="flex flex-col gap-2 rounded-2xl border border-brand-line p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-brand-ink [overflow-wrap:anywhere]">„{kopf}“</p>
                    <p className="truncate text-[12px] text-brand-ink-soft">{beispiele.length ? `z. B. ${beispiele.join(" · ")}` : "leer"}</p>
                  </div>
                  <span className="hidden text-brand-ink-soft sm:block" aria-hidden>
                    →
                  </span>
                  <div className="sm:w-[260px]">
                    <select
                      aria-label={`TanzRaum-Feld für Spalte ${kopf}`}
                      value={feld ?? ""}
                      onChange={(e) => {
                        const neu = (e.target.value || null) as FeldKey | null;
                        setZuordnung((alt) => alt.map((x, j) => (j === i ? neu : x)));
                        if (neu) feldUmschalten(neu, true);
                      }}
                      className={`min-h-11 w-full rounded-xl border px-3 text-[14px] ${feld ? "border-brand-ink/30 bg-white font-semibold" : "border-brand-line bg-brand-bg/50 text-brand-ink-soft"}`}
                    >
                      <option value="">Nicht importieren</option>
                      {FELDER.map((f) => (
                        <option key={f.key} value={f.key} disabled={zuordnung.some((x, j) => x === f.key && j !== i)}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    {feld && !auswahl.has(feld) && <p className="mt-1 text-[12px] text-brand-ink-soft">im vorigen Schritt abgewählt – wird nicht übernommen</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          {!namensOk && <p className="form-error mt-3">Bitte ordne Vorname und Nachname zu (oder eine Spalte mit dem vollen Namen).</p>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!namensOk}
              onClick={() => {
                if (gruppeAktiv) {
                  gruppenVorbelegen();
                  setSchritt("gruppen");
                } else void zurVorschau();
              }}
              className={KNOPF_HAUPT}
            >
              {gruppeAktiv ? "Weiter: Gruppen" : "Weiter: Import prüfen"}
            </button>
          </div>
        </section>
      )}

      {schritt === "gruppen" && (
        <section className={KARTE}>
          <h2 className="text-[20px] font-extrabold text-brand-ink">{zahl(gruppenInDatei.size, "Gruppe gefunden", "Gruppen gefunden")}</h2>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-brand-line px-3 py-2">
            <input type="checkbox" checked={gruppeAktiv} onChange={(e) => feldUmschalten("gruppe", e.target.checked)} className="h-5 w-5 accent-[var(--color-brand-red,#e11d2e)]" />
            <span className="text-[14px] font-semibold text-brand-ink">Gruppenzuordnung übernehmen</span>
          </label>
          <ul className="mt-3 flex flex-col gap-2">
            {[...gruppenInDatei.entries()].map(([name, n]) => {
              const istAltersklasse = altersklassen.some((a) => a.toLowerCase() === name.trim().toLowerCase());
              return (
                <li key={name} className="flex flex-col gap-2 rounded-2xl border border-brand-line p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-brand-ink [overflow-wrap:anywhere]">{name}</p>
                    <p className="text-[12.5px] text-brand-ink-soft">{zahl(n, "Mitglied", "Mitglieder")}</p>
                    {istAltersklasse && (
                      <p className="mt-1 text-[12px] text-brand-gold">„{name}“ ist eine Altersklasse, kein Gruppenname – bitte einer bestehenden Gruppe zuordnen.</p>
                    )}
                  </div>
                  <select
                    aria-label={`Zuordnung für ${name}`}
                    value={gruppenWahl[name] ?? "keine"}
                    onChange={(e) => setGruppenWahl((alt) => ({ ...alt, [name]: e.target.value }))}
                    className="min-h-11 rounded-xl border border-brand-line bg-white px-3 text-[14px] sm:w-[260px]"
                  >
                    {!istAltersklasse && !gruppen.some((g) => g.name.trim().toLowerCase() === name.trim().toLowerCase()) && <option value="neu">Neue Gruppe „{name.slice(0, 40)}“ anlegen</option>}
                    {gruppen.map((g) => (
                      <option key={g.id} value={g.id}>
                        Bestehende Gruppe: {g.name}
                      </option>
                    ))}
                    <option value="keine">Nicht zuordnen</option>
                  </select>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-brand-ink-soft">
            Neue Gruppen werden nur angelegt, wenn du es hier auswählst – zunächst nur mit ihrem Namen. Altersklasse, Disziplin, Trainer und Betreuer ergänzt du danach wie gewohnt im Gruppen-Assistenten. Die Mitglieder kommen in die Gruppe, sobald sie ihr TanzRaum-Konto verbunden haben.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void zurVorschau()} className={KNOPF_HAUPT}>
              Weiter: Import prüfen
            </button>
          </div>
        </section>
      )}

      {schritt === "vorschau" && (
        <section className={KARTE}>
          <h2 className="text-[20px] font-extrabold text-brand-ink">Import prüfen</h2>
          {laeuft && !treffer && (
            <p className="mt-3 flex items-center gap-2 text-[14px] text-brand-ink-soft">
              <Loader2 size={18} className="animate-spin" /> Abgleich mit den vorhandenen Mitgliedern …
            </p>
          )}
          {treffer && (
            <>
              <p className="mt-1 text-[26px] font-extrabold text-brand-ink">{zahl(zuImportieren.length, "Mitglied erkannt", "Mitglieder erkannt")}</p>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[14px] text-brand-ink sm:grid-cols-2">
                {FELDER.filter((f) => auswahl.has(f.key) && vorhanden.has(f.key) && f.key !== "name" && f.key !== "nachname" && f.key !== "gruppe").map((f) => (
                  <li key={f.key} className="flex items-center gap-2">
                    <Check size={15} className="text-brand-green" />
                    <span>
                      <strong>{zuImportieren.filter(({ d }) => !!(d as Record<string, unknown>)[f.key]).length}</strong> {f.key === "vorname" ? "Vor-/Nachnamen" : f.label}
                    </span>
                  </li>
                ))}
                {gruppeAktiv && (
                  <li className="flex items-center gap-2">
                    <Users size={15} className="text-brand-green" />
                    <span>
                      <strong>{Object.values(gruppenWahl).filter((w) => w !== "keine").length}</strong> Gruppen
                    </span>
                  </li>
                )}
              </ul>
              {sichtbareTreffer.length > 0 && (
                <p className="mt-3 rounded-xl bg-brand-bg px-3.5 py-2.5 text-[14px] font-semibold text-brand-ink">
                  {anzahlVorhanden} bereits vorhanden · {anzahlNeu} {anzahlNeu === 1 ? "neues Mitglied" : "neue Mitglieder"} · {zahl(anzahlAenderung, "mögliche Änderung", "mögliche Änderungen")}
                </p>
              )}
              {kontoHinweise.some((k) => k.art === "anderer_verein") && (
                <div className="mt-3 rounded-xl border border-brand-gold/50 bg-brand-gold-wash px-3.5 py-2.5 text-[13px] text-brand-ink">
                  <p className="font-semibold">
                    {zahl(kontoHinweise.filter((k) => k.art === "anderer_verein").length, "E-Mail-Adresse gehört", "E-Mail-Adressen gehören")} zu einem TanzRaum-Konto,
                    das bereits einem anderen Verein zugeordnet ist:
                  </p>
                  <p className="mt-0.5 [overflow-wrap:anywhere]">
                    {kontoHinweise.filter((k) => k.art === "anderer_verein").map((k) => k.email).join(", ")}
                  </p>
                  <p className="mt-1 text-brand-ink-soft">
                    Dieser TanzRaum-Nutzer ist bereits einem anderen Verein zugeordnet. Eine Übernahme ist nur nach Bestätigung durch den Nutzer möglich. Der Import
                    legt nur euren Stammdatensatz an – es entsteht kein zweites Konto und kein Wechsel. Über die persönliche Einladung kann die Person zustimmen.
                  </p>
                </div>
              )}
              {kontoHinweise.some((k) => k.art === "konto") && (
                <p className="mt-3 rounded-xl bg-brand-bg px-3.5 py-2.5 text-[13px] text-brand-ink">
                  {zahl(kontoHinweise.filter((k) => k.art === "konto").length, "Person hat", "Personen haben")} bereits ein TanzRaum-Konto. Mit der persönlichen Einladung
                  wird dieses Konto verbunden – es entsteht kein zweites Konto.
                </p>
              )}
              {aufbereitet.doppelt.size > 0 && (
                <p className="mt-3 rounded-xl bg-brand-gold-wash px-3.5 py-2.5 text-[13px] text-brand-ink">
                  {zahl(aufbereitet.doppelt.size, "Eintrag kommt", "Einträge kommen")} in der Datei doppelt vor (gleiche E-Mail oder Mitgliedsnummer) und {aufbereitet.doppelt.size === 1 ? "wird" : "werden"} nur einmal übernommen.
                </p>
              )}
              {aufbereitet.hinweise.length > 0 && (
                <details className="mt-3 rounded-xl border border-brand-line px-3.5 py-2.5 text-[13px]">
                  <summary className="cursor-pointer font-semibold text-brand-ink">{zahl(aufbereitet.hinweise.length, "Hinweis", "Hinweise")} zu einzelnen Zeilen</summary>
                  <ul className="mt-2 flex flex-col gap-1 text-brand-ink-soft">
                    {aufbereitet.hinweise.slice(0, 50).map((h, i) => (
                      <li key={i}>
                        Zeile {h.zeile}: {h.text}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {sichtbareTreffer.length > 0 && (
                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[15px] font-bold text-brand-ink">⚠️ {zahl(sichtbareTreffer.length, "mögliches bereits vorhandenes Mitglied", "mögliche bereits vorhandene Mitglieder")}</h3>
                    <div className="flex gap-2 text-[12.5px]">
                      <button type="button" onClick={() => setEntscheidung(Object.fromEntries([...treffer.keys()].map((i) => [i, "vorhanden"])))} className="font-semibold text-brand-ink hover:underline">
                        Alle: vorhandene verwenden
                      </button>
                    </div>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2">
                    {sichtbareTreffer.slice(0, alleTreffer ? undefined : 15).map((t) => {
                      const d = aufbereitet.daten[t.idx];
                      if (!d) return null;
                      const aend = Object.entries(t.aenderungen);
                      return (
                        <li key={t.idx} className="rounded-2xl border border-brand-gold/40 bg-brand-gold-wash/30 p-3">
                          <p className="text-[14px] font-bold text-brand-ink [overflow-wrap:anywhere]">
                            {d.vorname} {d.nachname}
                            {d.email && <span className="font-normal text-brand-ink-soft"> · {d.email}</span>}
                          </p>
                          <p className="text-[12.5px] text-brand-ink-soft">
                            Vorhanden: {t.zielName} {t.zielArt === "konto" ? "(mit TanzRaum-Konto)" : ""} – {TREFFER_TEXT[t.treffer]}
                          </p>
                          <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                            {(["vorhanden", "neu"] as Entscheidung[]).map((e) => (
                              <label key={e} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold ${entscheidung[t.idx] === e ? "border-brand-ink bg-white" : "border-brand-line"}`}>
                                <input type="radio" name={`t-${t.idx}`} checked={entscheidung[t.idx] === e} onChange={() => setEntscheidung((alt) => ({ ...alt, [t.idx]: e }))} />
                                {e === "vorhanden" ? "Vorhandenes Mitglied verwenden" : "Als neues Mitglied importieren"}
                              </label>
                            ))}
                          </div>
                          {aend.length > 0 && entscheidung[t.idx] === "vorhanden" && (
                            <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13px]">
                              <input type="checkbox" checked={!!uebernehmen[t.idx]} onChange={(e) => setUebernehmen((alt) => ({ ...alt, [t.idx]: e.target.checked }))} className="mt-0.5 h-4 w-4" />
                              <span>
                                Änderungen übernehmen:{" "}
                                {aend.map(([k, v]) => `${FELD[k as FeldKey]?.label ?? k}: ${wertText(k as FeldKey, v.alt ?? undefined)} → ${wertText(k as FeldKey, v.neu)}`).join(" · ")}
                              </span>
                            </label>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {sichtbareTreffer.length > 15 && !alleTreffer && (
                    <button type="button" onClick={() => setAlleTreffer(true)} className="mt-2 text-[13px] font-semibold text-brand-red hover:underline">
                      Alle {sichtbareTreffer.length} anzeigen
                    </button>
                  )}
                  <p className="mt-2 text-[12.5px] text-brand-ink-soft">Bestehende Daten werden nur überschrieben, wenn du „Änderungen übernehmen“ ankreuzt.</p>
                </div>
              )}

              <h3 className="mt-6 text-[15px] font-bold text-brand-ink">Vorschau der Datensätze</h3>
              <ul className="mt-2 flex flex-col divide-y divide-brand-line rounded-2xl border border-brand-line">
                {zuImportieren.slice(0, 50).map(({ d, i }) => {
                  const t = treffer.get(i);
                  const status = t && entscheidung[i] === "vorhanden" ? (uebernehmen[i] ? "Änderung" : "Vorhanden") : "Neu";
                  const weitere = FELDER.filter((f) => auswahl.has(f.key) && !["vorname", "nachname", "name", "email", "gruppe"].includes(f.key))
                    .map((f) => ((d as unknown as Record<string, string | undefined>)[f.key] ? `${f.label}: ${wertText(f.key, (d as unknown as Record<string, string | undefined>)[f.key])}` : null))
                    .filter(Boolean);
                  return (
                    <li key={i} className="flex items-start gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-brand-ink [overflow-wrap:anywhere]">
                          {d.vorname} {d.nachname}
                        </p>
                        <p className="text-[12.5px] text-brand-ink-soft [overflow-wrap:anywhere]">
                          {[d.email ?? "keine E-Mail", gruppeAktiv && d.gruppe && gruppenWahl[d.gruppe] !== "keine" ? d.gruppe : null, ...weitere].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${status === "Neu" ? "bg-brand-green-wash text-brand-green" : "bg-brand-bg text-brand-ink-soft"}`}>{status}</span>
                    </li>
                  );
                })}
                {zuImportieren.length > 50 && <li className="px-3 py-2.5 text-[13px] text-brand-ink-soft">… und {zuImportieren.length - 50} weitere</li>}
              </ul>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button type="button" disabled={laeuft || zuImportieren.length === 0} onClick={() => void importieren()} className={KNOPF_HAUPT}>
                  {laeuft ? <Loader2 size={18} className="animate-spin" /> : null}
                  {zahl(zuImportieren.length, "Mitglied importieren", "Mitglieder importieren")}
                </button>
                <p className="text-[12.5px] text-brand-ink-soft">Erst mit diesem Klick wird gespeichert. Es werden keine TanzRaum-Konten erstellt.</p>
              </div>
            </>
          )}
        </section>
      )}

      {schritt === "fertig" && ergebnis && (
        <section className={KARTE}>
          <h2 className="text-[22px] font-extrabold text-brand-ink">
            🎉 {zahl(ergebnis.neu + ergebnis.verknuepft + ergebnis.aktualisiert, "Vereinsmitglied", "Vereinsmitglieder")} erfolgreich importiert
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-brand-ink">
            Die Mitglieder wurden deinem Verein {vereinName ? `„${vereinName}“ ` : ""}hinzugefügt. Es wurden dadurch noch keine neuen TanzRaum-Konten erstellt.
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-[13.5px] text-brand-ink-soft">
            {ergebnis.neu > 0 && <li>• {zahl(ergebnis.neu, "neues Vereinsmitglied", "neue Vereinsmitglieder")}</li>}
            {ergebnis.verknuepft > 0 && <li>• {zahl(ergebnis.verknuepft, "Mitglied", "Mitglieder")} mit vorhandenem TanzRaum-Konto verbunden</li>}
            {ergebnis.aktualisiert > 0 && <li>• {zahl(ergebnis.aktualisiert, "vorhandenes Mitglied", "vorhandene Mitglieder")} aktualisiert</li>}
            {ergebnis.unveraendert > 0 && <li>• {zahl(ergebnis.unveraendert, "vorhandenes Mitglied", "vorhandene Mitglieder")} unverändert</li>}
            {ergebnis.gruppenNeu > 0 && <li>• {zahl(ergebnis.gruppenNeu, "neue Gruppe", "neue Gruppen")} angelegt</li>}
          </ul>
          <p className="mt-4 rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px] text-brand-ink">
            Nächster Schritt: Lade deine Mitglieder per E-Mail oder persönlichem Einladungslink ein. Jedes Mitglied registriert sich selbst – danach wechselt der Status automatisch auf 🟢 „TanzRaum-Konto vorhanden“.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href={`/dashboard/mitglieder?verein=${vereinId}&konto=ohne`} className={KNOPF_HAUPT}>
              Mitglieder einladen
            </Link>
            <Link href={`/dashboard/mitglieder?verein=${vereinId}`} className={KNOPF_NEBEN}>
              Zur Mitgliederliste
            </Link>
          </div>
        </section>
      )}

      {fehler && <p className="form-error">{fehler}</p>}
    </div>
  );
}
