"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Download, ExternalLink, FileText, Mail, X } from "lucide-react";
import { rechnungErneutSenden } from "@/app/dashboard/admin/rechnungen/actions";
import { AufbewahrungSperre } from "@/components/admin/AufbewahrungSperre";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

export type RechnungZeile = {
  id: string;
  nummer: string;
  rechnungsdatum: string;
  empfaenger_name: string;
  empfaenger_email: string;
  leistung: string;
  betrag: number;
  zahlungsweg: string;
  versendet: boolean;
  versendet_am: string | null;
  aufbewahren_bis: string;
  anonymisierung_gesperrt: boolean;
  sperrgrund: string | null;
  anonymisiert_am: string | null;
};

const PDF = "/dashboard/admin/rechnungen/pdf";
const datum = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-DE") : "");
const euro = (n: number) => Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

function zahlart(w: string): string {
  const z = (w ?? "").toLowerCase();
  if (z === "paypal") return "PayPal";
  if (z.startsWith("lastschrift")) return "Lastschrift";
  if (z.includes("stripe")) return "Karte/Lastschrift";
  return "Überweisung";
}

const KNOPF =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50";

// Rechnungsliste mit Vorschau: Klick auf eine Zeile zeigt die komplette Rechnung (PDF) daneben bzw. darunter
export function RechnungenListe({ liste }: { liste: RechnungZeile[] }) {
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const r = liste.find((x) => x.id === auswahl) ?? null;
  const vorschau = useRef<HTMLElement>(null);

  // Unterhalb von 2xl steht die Vorschau unter der Liste -> dorthin scrollen
  useEffect(() => {
    if (auswahl && window.innerWidth < 1536) vorschau.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [auswahl]);

  const senden = (id: string) =>
    starte(async () => {
      setMeldung(null);
      setMeldung(await rechnungErneutSenden(id));
    });

  return (
    <div className={`grid grid-cols-1 gap-4 ${r ? "2xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]" : ""}`}>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead className="text-[12px] uppercase tracking-wide text-brand-ink-soft">
            <tr>
              <th className="py-2 pr-3">Nummer</th>
              <th className="py-2 pr-3">Datum</th>
              <th className="py-2 pr-3">Empfänger</th>
              <th className="py-2 pr-3">Leistung</th>
              <th className="py-2 pr-3">Zahlart</th>
              <th className="py-2 pr-3 text-right">Betrag</th>
              <th className="py-2">Versand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {liste.map((z) => (
              <tr
                key={z.id}
                onClick={() => {
                  setAuswahl(z.id === auswahl ? null : z.id);
                  setMeldung(null);
                }}
                className={`cursor-pointer hover:bg-brand-bg ${z.id === auswahl ? "bg-brand-red-wash" : ""}`}
              >
                <td className="py-2.5 pr-3 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText size={14} className="text-brand-red" /> {z.nummer}
                  </span>
                </td>
                <td className="py-2.5 pr-3">{datum(z.rechnungsdatum)}</td>
                <td className="max-w-[180px] truncate py-2.5 pr-3">{z.anonymisiert_am ? <span className="text-brand-ink-soft">anonymisiert</span> : z.empfaenger_name}</td>
                <td className="max-w-[220px] truncate py-2.5 pr-3">{z.leistung}</td>
                <td className="py-2.5 pr-3">{zahlart(z.zahlungsweg)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{euro(z.betrag)}</td>
                <td className="py-2.5">
                  {z.versendet ? (
                    <span className="rounded-full bg-brand-green-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-green">{datum(z.versendet_am)}</span>
                  ) : (
                    <span className="rounded-full bg-brand-amber-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink">offen</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r && (
        <aside ref={vorschau} className="flex min-w-0 scroll-mt-4 flex-col gap-3 rounded-2xl border border-brand-line bg-brand-bg p-3 2xl:sticky 2xl:top-4 2xl:self-start">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold text-brand-ink">Rechnung {r.nummer}</h3>
              <p className="truncate text-[12.5px] text-brand-ink-soft">
                {r.anonymisiert_am ? "Empfänger anonymisiert" : `${r.empfaenger_name} · ${r.empfaenger_email || "keine E-Mail"}`}
              </p>
            </div>
            <button type="button" onClick={() => setAuswahl(null)} aria-label="Vorschau schließen" className="rounded-lg p-1.5 text-brand-ink-soft hover:bg-white">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`${PDF}?id=${r.id}&download=1`} className={KNOPF}>
              <Download size={16} /> PDF herunterladen
            </a>
            <button type="button" disabled={laeuft || !!r.anonymisiert_am} onClick={() => senden(r.id)} className={KNOPF}>
              <Mail size={16} /> {laeuft ? "Wird gesendet …" : "Erneut per E-Mail senden"}
            </button>
            <a href={`${PDF}?id=${r.id}`} target="_blank" rel="noopener" className={KNOPF}>
              <ExternalLink size={16} /> Neuer Tab
            </a>
          </div>
          {meldung?.error && <p className="form-error">{meldung.error}</p>}
          {meldung?.ok && <p className="form-success">{meldung.ok}</p>}
          <iframe key={r.id} src={`${PDF}?id=${r.id}`} title={`Rechnung ${r.nummer}`} className="h-[70vh] min-h-[480px] w-full rounded-xl border border-brand-line bg-white" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-brand-ink-soft">
            <span>Aufbewahren bis {datum(r.aufbewahren_bis)}</span>
            {!r.anonymisiert_am && <AufbewahrungSperre id={r.id} gesperrt={r.anonymisierung_gesperrt} grund={r.sperrgrund} />}
          </div>
        </aside>
      )}
    </div>
  );
}
