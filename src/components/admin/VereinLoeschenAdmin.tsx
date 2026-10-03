"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { vereinEndgueltigLoeschen, vereinLoeschenPruefen, type VereinLoeschPruefung } from "@/app/dashboard/admin/vereine/actions";

// TanzRaum-Admin: Verein endgueltig loeschen – erst Pruefung (was wird geloescht, was steht entgegen), dann Bestaetigung mit dem
// Vereinsnamen. Die Datenbank prueft alles erneut und protokolliert die Loeschung.
export function VereinLoeschenAdmin({ vereinId, vereinName }: { vereinId: string; vereinName: string }) {
  const [pruefung, setPruefung] = useState<VereinLoeschPruefung | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const passt = eingabe.trim().toLowerCase() === vereinName.trim().toLowerCase();
  const gesperrt = (pruefung?.hindernisse.length ?? 0) > 0;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-brand-red/30 bg-white p-4 shadow-[var(--shadow)] sm:p-5">
      <h2 className="flex items-center gap-2 text-[16px] font-bold text-brand-red">
        <Trash2 size={18} /> Verein löschen
      </h2>
      <p className="text-[13px] text-brand-ink-soft">
        Löscht den Verein mit allen Vereinsdaten (Mitgliedschaften, Tanzgruppen, Trainings, Termine, Dateien, Chats …) endgültig. Das kann nicht
        rückgängig gemacht werden. Persönliche Konten der Mitglieder bleiben erhalten.
      </p>
      {!pruefung ? (
        <div>
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                setFehler(null);
                const r = await vereinLoeschenPruefen(vereinId);
                if (r.error || !r.pruefung) setFehler(r.error ?? "Prüfung fehlgeschlagen.");
                else setPruefung(r.pruefung);
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-red/40 bg-white px-4 text-[13.5px] font-semibold text-brand-red hover:bg-brand-red-wash disabled:opacity-50"
          >
            <Trash2 size={16} /> {laeuft ? "Wird geprüft …" : "Verein löschen …"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pruefung.zahlen.map((z) => (
              <div key={z.label} className="rounded-xl bg-brand-bg px-3 py-2">
                <div className="text-[18px] font-extrabold tabular-nums text-brand-ink">{z.wert}</div>
                <div className="text-[12px] text-brand-ink-soft">{z.label}</div>
              </div>
            ))}
          </div>
          {pruefung.lizenz && <p className="text-[13px] font-semibold text-brand-ink">Der Verein hat eine aktive Vereinslizenz.</p>}
          {gesperrt ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-brand-amber/40 bg-brand-gold-wash px-3 py-2.5">
              <p className="flex items-center gap-2 text-[13.5px] font-bold text-brand-ink">
                <AlertTriangle size={16} className="text-brand-amber" /> Löschen gerade nicht möglich
              </p>
              <ul className="list-disc pl-5 text-[13px] text-brand-ink">
                {pruefung.hindernisse.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <label className="field">
                <span>
                  Zur Bestätigung den Vereinsnamen eingeben: <strong>{vereinName}</strong>
                </span>
                <input value={eingabe} onChange={(e) => setEingabe(e.target.value)} autoComplete="off" placeholder={vereinName} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!passt || laeuft}
                  onClick={() =>
                    starte(async () => {
                      setFehler(null);
                      const r = await vereinEndgueltigLoeschen(vereinId, eingabe);
                      if (r?.error) setFehler(r.error);
                    })
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-bold text-white disabled:opacity-50"
                >
                  <Trash2 size={16} /> {laeuft ? "Wird gelöscht …" : "Endgültig löschen"}
                </button>
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => {
                    setPruefung(null);
                    setEingabe("");
                  }}
                  className="inline-flex min-h-11 items-center rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink"
                >
                  Abbrechen
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {fehler && <p className="form-error">{fehler}</p>}
    </section>
  );
}
