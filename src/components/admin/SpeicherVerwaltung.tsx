"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, HardDrive, Save, Server, User } from "lucide-react";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { speicherSpeichern } from "@/app/dashboard/admin/speicher/actions";
import { MB, mbText, speicherStufe, speicherText, type SpeicherUebersicht } from "@/lib/speicher";

const KARTE = "flex min-w-0 flex-col gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5";

const STUFE_FARBE: Record<number, string> = {
  0: "bg-brand-green",
  80: "bg-brand-amber",
  90: "bg-brand-red",
  95: "bg-brand-red",
  100: "bg-brand-red",
};

// Ganze Zahl in MB aus einer Eingabe (leer = null)
const zahl = (wert: string): number | null => {
  const t = wert.replace(/[.\s]/g, "").trim();
  if (t === "") return null;
  return /^\d{1,10}$/.test(t) ? Number(t) : NaN;
};

function Balken({ anteil, farbe, label }: { anteil: number; farbe: string; label: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-bg" role="progressbar" aria-label={label} aria-valuenow={Math.round(anteil)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${farbe}`} style={{ width: `${Math.min(100, Math.max(anteil > 0 ? 1.5 : 0, anteil))}%` }} />
    </div>
  );
}

// Speicherverwaltung der TanzRaum-Administration: technischer Speicher (Info) und freigegebener Gesamtspeicher getrennt,
// Kontingente je Bereich (MB). Speichern ueber admin_speicher_speichern (Admin-Pruefung + Protokoll in der Datenbank).
export function SpeicherVerwaltung({ u }: { u: SpeicherUebersicht }) {
  const router = useRouter();
  const [gesamt, setGesamt] = useState(String(u.gesamtMb));
  const [technisch, setTechnisch] = useState(u.technischMb === null ? "" : String(u.technischMb));
  const [werte, setWerte] = useState<Record<string, { limit: string; aktiv: boolean }>>(
    Object.fromEntries(u.kategorien.map((k) => [k.schluessel, { limit: String(k.limitMb), aktiv: k.aktiv }])),
  );
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const gesamtBytes = u.gesamtMb * MB;
  const prozent = gesamtBytes > 0 ? (u.belegt / gesamtBytes) * 100 : 100;
  const stufe = speicherStufe(prozent);
  const technischUeberschritten = u.technischMb !== null && u.gesamtMb > u.technischMb;
  const bereiche = [...u.kategorien.map((k) => ({ name: k.bezeichnung, belegt: k.belegt, dateien: k.dateien })), { name: "Sonstige (z. B. Ankündigungsbilder)", belegt: u.sonstige, dateien: -1 }];
  const maxBereich = Math.max(1, ...bereiche.map((b) => b.belegt));

  const gesamtNeu = zahl(gesamt);
  const technischNeu = zahl(technisch);
  const geaendert =
    gesamtNeu !== u.gesamtMb ||
    technischNeu !== u.technischMb ||
    u.kategorien.some((k) => zahl(werte[k.schluessel].limit) !== k.limitMb || werte[k.schluessel].aktiv !== k.aktiv);

  const speichern = () =>
    starte(async () => {
      if (gesamtNeu === null || Number.isNaN(gesamtNeu) || gesamtNeu < 1) return setMeldung({ error: "Bitte den Gesamtspeicher als ganze Zahl in MB angeben." });
      if (Number.isNaN(technischNeu as number)) return setMeldung({ error: "Bitte den technischen Speicher als ganze Zahl in MB angeben (oder leer lassen)." });
      const liste = u.kategorien.map((k) => ({ schluessel: k.schluessel, limitMb: zahl(werte[k.schluessel].limit) ?? NaN, aktiv: werte[k.schluessel].aktiv }));
      const falsch = liste.find((k) => Number.isNaN(k.limitMb));
      if (falsch) return setMeldung({ error: `Bitte für „${u.kategorien.find((k) => k.schluessel === falsch.schluessel)?.bezeichnung}“ eine ganze Zahl in MB angeben.` });
      const r = await speicherSpeichern(gesamtNeu, technischNeu, liste);
      setMeldung(r);
      if (!r.error) router.refresh();
    });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Übersicht */}
      <section className={KARTE} aria-label="Speicherübersicht">
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-brand-ink">
          <HardDrive size={18} className="text-brand-red" /> TanzRaum-Speicher
        </h2>
        {stufe.text && (
          <p
            role="alert"
            className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold ${stufe.stufe >= 90 ? "bg-brand-red-wash text-brand-red" : "bg-brand-amber-wash text-brand-ink"}`}
          >
            <AlertTriangle size={17} className="mt-0.5 shrink-0" /> {stufe.text}
          </p>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-[22px] font-extrabold text-brand-ink">{Math.min(999, Math.round(prozent))} %</span>
          <span className="text-[13px] text-brand-ink-soft">
            freigegeben: <b className="text-brand-ink">{mbText(u.gesamtMb)}</b>
          </span>
        </div>
        <Balken anteil={prozent} farbe={STUFE_FARBE[stufe.stufe]} label="Belegung des TanzRaum-Speichers" />
        <dl className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
          {[
            ["Belegt", speicherText(u.belegt)],
            ["Verfügbar", speicherText(Math.max(0, gesamtBytes - u.belegt))],
            ["Dateien", u.dateien.toLocaleString("de-DE")],
            ["Nutzer · Vereine mit Dateien", `${u.nutzer} · ${u.vereine}`],
          ].map(([t, w]) => (
            <div key={t} className="rounded-xl bg-brand-bg px-3 py-2">
              <dt className="text-[11.5px] text-brand-ink-soft">{t}</dt>
              <dd className="font-bold text-brand-ink">{w}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-start gap-2 text-[12.5px] text-brand-ink-soft">
          <Server size={15} className="mt-0.5 shrink-0" />
          <span>
            Technisch verfügbar (laut Speicher-Anbieter, nur zur Information): <b className="text-brand-ink">{u.technischMb === null ? "nicht angegeben" : mbText(u.technischMb)}</b>.
            Der freigegebene TanzRaum-Speicher ist bewusst ein eigener Wert – er wird nie automatisch aus dem technischen Speicher übernommen.
          </span>
        </p>
        {technischUeberschritten && (
          <p role="alert" className="rounded-xl bg-brand-red-wash px-3.5 py-2.5 text-[13px] font-semibold text-brand-red">
            Der freigegebene TanzRaum-Speicher ({mbText(u.gesamtMb)}) ist größer als der technisch verfügbare Speicher ({mbText(u.technischMb!)}).
          </p>
        )}
      </section>

      {/* Verbrauch nach Bereich */}
      <section className={KARTE} aria-label="Speicherverbrauch nach Bereich">
        <h2 className="text-[16px] font-bold text-brand-ink">Speicherverbrauch nach Bereich</h2>
        <ul className="flex flex-col gap-2.5">
          {bereiche.map((b) => (
            <li key={b.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate font-semibold text-brand-ink">{b.name}</span>
                <span className="shrink-0 text-brand-ink-soft">
                  {speicherText(b.belegt)}
                  {b.dateien >= 0 ? ` · ${b.dateien} ${b.dateien === 1 ? "Datei" : "Dateien"}` : ""}
                </span>
              </div>
              <Balken anteil={(b.belegt / maxBereich) * 100} farbe="bg-brand-red/80" label={`Verbrauch ${b.name}`} />
            </li>
          ))}
        </ul>
      </section>

      {/* Einstellungen */}
      <section className={KARTE} aria-label="Speicher einstellen">
        <h2 className="text-[16px] font-bold text-brand-ink">Speicher einstellen</h2>
        <p className="text-[12.5px] text-brand-ink-soft">Alle Werte in MB (1 GB = 1.024 MB). Kontingente gelten je Verein bzw. je Person im jeweiligen Bereich.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Freigegebener TanzRaum-Speicher (MB)</span>
            <input inputMode="numeric" value={gesamt} onChange={(e) => setGesamt(e.target.value)} aria-describedby="gesamt-text" />
            <small id="gesamt-text" className="text-[12px] text-brand-ink-soft">
              {gesamtNeu && !Number.isNaN(gesamtNeu) ? `= ${mbText(gesamtNeu)}` : "ganze Zahl in MB"}
            </small>
          </label>
          <label className="field">
            <span>Technisch verfügbarer Speicher (MB, optional)</span>
            <input inputMode="numeric" value={technisch} onChange={(e) => setTechnisch(e.target.value)} placeholder="z. B. 1024" />
            <small className="text-[12px] text-brand-ink-soft">{technischNeu && !Number.isNaN(technischNeu) ? `= ${mbText(technischNeu)} · nur Information` : "nur Information"}</small>
          </label>
        </div>

        <ul className="flex flex-col divide-y divide-brand-line rounded-xl border border-brand-line">
          {u.kategorien.map((k) => {
            const w = werte[k.schluessel];
            const neu = zahl(w.limit);
            const limitBytes = (neu ?? k.limitMb) * MB;
            return (
              <li key={k.schluessel} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-bold text-brand-ink">{k.bezeichnung}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-bg px-2 py-0.5 text-[11px] font-semibold text-brand-ink-soft">
                      {k.bezug === "verein" ? <Building2 size={11} /> : <User size={11} />} je {k.bezug === "verein" ? "Verein" : "Person"}
                    </span>
                    {!w.aktiv && <span className="rounded-full bg-brand-red-wash px-2 py-0.5 text-[11px] font-bold text-brand-red">Uploads aus</span>}
                  </div>
                  {k.beschreibung && <p className="text-[12px] text-brand-ink-soft">{k.beschreibung}</p>}
                  <p className="text-[12px] text-brand-ink-soft">insgesamt belegt: {speicherText(k.belegt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <label className="flex items-center gap-1.5">
                    <span className="sr-only">Kontingent {k.bezeichnung} in MB</span>
                    <input
                      inputMode="numeric"
                      value={w.limit}
                      onChange={(e) => setWerte((x) => ({ ...x, [k.schluessel]: { ...x[k.schluessel], limit: e.target.value } }))}
                      className="h-10 w-28 rounded-lg border border-brand-line bg-white px-2.5 text-right text-[14px] font-semibold text-brand-ink"
                      aria-label={`Kontingent ${k.bezeichnung} in MB`}
                    />
                    <span className="text-[13px] text-brand-ink-soft">MB</span>
                  </label>
                  <span className="w-16 text-[12px] text-brand-ink-soft">{neu !== null && !Number.isNaN(neu) ? `= ${speicherText(limitBytes)}` : ""}</span>
                  <label className="flex min-h-10 items-center gap-2 text-[13px] text-brand-ink">
                    <input
                      type="checkbox"
                      checked={w.aktiv}
                      onChange={(e) => setWerte((x) => ({ ...x, [k.schluessel]: { ...x[k.schluessel], aktiv: e.target.checked } }))}
                      className="h-4 w-4 accent-brand-red"
                      aria-label={`Uploads in ${k.bezeichnung} erlaubt`}
                    />
                    Uploads erlaubt
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[12px] text-brand-ink-soft">
          Erhöhen gilt sofort. Beim Verringern wird nichts gelöscht – wer schon mehr belegt, kann erst nach dem Entfernen von Dateien wieder hochladen. Jede
          Änderung steht im Protokoll.
        </p>
        {meldung && <Meldung ergebnis={meldung} />}
        <button
          type="button"
          onClick={speichern}
          disabled={laeuft || !geaendert}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-50"
        >
          <Save size={16} /> {laeuft ? "Wird gespeichert …" : "Änderungen speichern"}
        </button>
      </section>

      {/* Größte Verbraucher */}
      <section className={KARTE} aria-label="Größte Verbraucher">
        <h2 className="text-[16px] font-bold text-brand-ink">Größte Verbraucher</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { titel: "Vereine", icon: Building2, liste: u.topVereine },
            { titel: "Personen", icon: User, liste: u.topNutzer },
          ].map(({ titel, icon: Icon, liste }) => (
            <div key={titel} className="min-w-0">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-brand-ink">
                <Icon size={14} /> {titel}
              </h3>
              {liste.length === 0 ? (
                <p className="text-[12.5px] text-brand-ink-soft">Noch keine Dateien.</p>
              ) : (
                <ol className="flex flex-col gap-1 text-[13px]">
                  {liste.map((x, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-brand-ink">{x.name}</span>
                      <span className="shrink-0 text-brand-ink-soft">{speicherText(x.belegt)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
