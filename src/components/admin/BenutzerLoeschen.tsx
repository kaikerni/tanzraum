"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Trash2, Undo2 } from "lucide-react";
import { kontoLoeschenAdmin, kontoLoeschPruefungAdmin, kontoLoeschungAbbrechenAdmin } from "@/app/dashboard/admin/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";

export type Benutzer = {
  user_id: string;
  name: string | null;
  handle: string | null;
  email_maskiert: string | null;
  tarif: string | null;
  registriert_am: string;
  gesperrt: boolean;
  verein: string | null;
  ist_admin: boolean;
  loeschen_ab: string | null;
  loeschung_durch_admin: boolean;
  blockiert: string | null;
};

const datum = (d: string) => new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
const KNOPF = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold disabled:opacity-50";

// Eine Zeile je Konto: Angaben + Loeschen (mit Grund, Zeitpunkt und Bestaetigung) bzw. Abbrechen
export function BenutzerZeile({ b }: { b: Benutzer }) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [offen, setOffen] = useState(false);
  const [grund, setGrund] = useState("");
  const [sofort, setSofort] = useState(false);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  // Vorab-Pruefung beim Oeffnen: konkrete Gruende statt eines still deaktivierten Knopfs
  const [pruefung, setPruefung] = useState<{ hindernisse: string[]; hinweise: string[]; fehler: string | null } | null>(null);
  useEffect(() => {
    if (!offen) return;
    let aktiv = true;
    setPruefung(null);
    kontoLoeschPruefungAdmin(b.user_id).then((r) => {
      if (aktiv) setPruefung({ hindernisse: r.hindernisse, hinweise: r.hinweise, fehler: r.error });
    });
    return () => {
      aktiv = false;
    };
  }, [offen, b.user_id]);
  const gesperrt = !pruefung || !!pruefung.fehler || pruefung.hindernisse.length > 0;
  const fehlt = [!grund.trim() ? "Grund angeben" : null, !bestaetigt ? "Bestätigung ankreuzen" : null].filter(Boolean) as string[];
  const aktion = (f: () => Promise<AktionsErgebnis>) =>
    starte(async () => {
      const r = await f();
      setMeldung(r);
      if (!r.error) {
        setOffen(false);
        router.refresh();
      }
    });

  const name = b.name ?? (b.handle ? `@${b.handle}` : "Ohne Namen");
  const geplant = b.loeschen_ab && new Date(b.loeschen_ab).getTime() > Date.now();

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold text-brand-ink">
            {name}
            {b.handle && b.name ? <span className="font-normal text-brand-ink-soft"> · @{b.handle}</span> : null}
          </p>
          <p className="text-[12.5px] text-brand-ink-soft">
            {[b.email_maskiert, (b.tarif ?? "free").toUpperCase(), `seit ${datum(b.registriert_am)}`, b.verein ? `Verein: ${b.verein}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {b.ist_admin && <span className="rounded-full bg-brand-ink px-2 py-0.5 text-[11.5px] font-semibold text-white">TanzRaum-Admin</span>}
            {b.gesperrt && <span className="rounded-full bg-brand-red-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-red">gesperrt</span>}
            {b.loeschen_ab && (
              <span className="rounded-full bg-brand-gold-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink">
                {geplant ? `wird am ${datum(b.loeschen_ab)} gelöscht` : "Löschung fällig"} · {b.loeschung_durch_admin ? "durch Administration" : "selbst beantragt"}
              </span>
            )}
          </div>
          {b.blockiert && <p className="mt-1 text-[12.5px] text-brand-red">Noch blockiert: {b.blockiert}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {geplant && b.loeschung_durch_admin ? (
            <button
              type="button"
              disabled={laeuft}
              onClick={() => aktion(() => kontoLoeschungAbbrechenAdmin(b.user_id))}
              className={`${KNOPF} border-brand-line bg-white text-brand-ink hover:bg-brand-bg`}
            >
              <Undo2 size={15} /> Löschung abbrechen
            </button>
          ) : null}
          {b.verein && !b.loeschen_ab && (
            <span className="max-w-[220px] text-[12px] sm:text-right text-brand-ink-soft">Vereinsmitglied – zuerst muss der Verein die Person entfernen.</span>
          )}
          {!b.ist_admin && !b.verein && !offen && (!b.loeschen_ab || geplant) && (
            <button type="button" onClick={() => setOffen(true)} className={`${KNOPF} border-brand-red/40 bg-white text-brand-red hover:bg-brand-red-wash`}>
              <Trash2 size={15} /> {geplant ? "Sofort löschen" : "Konto löschen"}
            </button>
          )}
        </div>
      </div>

      {offen && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand-red/30 bg-brand-red-wash/40 p-3">
          {!pruefung && <p className="text-[13px] text-brand-ink-soft">Löschung wird geprüft …</p>}
          {pruefung?.fehler && <p className="form-error">{pruefung.fehler}</p>}
          {pruefung && pruefung.hindernisse.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-brand-red/40 bg-white px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-brand-red">
                <AlertTriangle size={15} /> Löschen derzeit nicht möglich, weil …
              </p>
              <ul className="list-disc pl-5 text-[13px] text-brand-ink">
                {pruefung.hindernisse.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {pruefung && pruefung.hinweise.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-brand-line bg-white px-3 py-2.5 text-[13px] text-brand-ink">
              {pruefung.hinweise.map((h) => (
                <p key={h} className="flex items-start gap-1.5">
                  <Info size={14} className="mt-0.5 shrink-0 text-brand-blue" /> {h}
                </p>
              ))}
            </div>
          )}
          <label className="field">
            <span>Grund (wird protokolliert, nicht an die Person geschickt)</span>
            <textarea rows={2} maxLength={500} value={grund} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Wunsch per E-Mail vom …, Verstoß gegen die Nutzungsbedingungen" />
          </label>
          <fieldset className="flex flex-col gap-1.5 text-[13.5px] text-brand-ink">
            <label className="flex items-start gap-2">
              <input type="radio" name={`zeit-${b.user_id}`} checked={!sofort} onChange={() => setSofort(false)} className="mt-1" disabled={!!geplant} />
              <span>
                <strong>In 14 Tagen</strong> – Konto wird sofort gesperrt, die Löschung kannst du bis dahin hier abbrechen.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name={`zeit-${b.user_id}`} checked={sofort || !!geplant} onChange={() => setSofort(true)} className="mt-1" />
              <span>
                <strong>Sofort endgültig</strong> – nicht rückgängig zu machen.
              </span>
            </label>
          </fieldset>
          <label className="flex items-start gap-2 text-[13px] text-brand-ink">
            <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} className="mt-0.5" />
            <span>
              Ich habe geprüft, dass das Konto von <strong>{name}</strong> gelöscht werden soll. Profil, eigene Inhalte und Dateien werden entfernt; Rechnungen
              bleiben (Aufbewahrungspflicht), gesendete Chatnachrichten erscheinen als „Gelöschtes Konto“.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={laeuft || gesperrt || !bestaetigt || !grund.trim()}
              onClick={() => aktion(() => kontoLoeschenAdmin(b.user_id, grund, sofort || !!geplant))}
              className={`${KNOPF} border-brand-red bg-brand-red text-white hover:bg-brand-red-deep`}
            >
              <Trash2 size={15} /> {laeuft ? "Wird ausgeführt …" : sofort || geplant ? "Jetzt endgültig löschen" : "Löschung in 14 Tagen"}
            </button>
            <button type="button" onClick={() => setOffen(false)} className={`${KNOPF} border-brand-line bg-white text-brand-ink hover:bg-brand-bg`}>
              Abbrechen
            </button>
          </div>
          {pruefung && !gesperrt && fehlt.length > 0 && <p className="text-[12.5px] font-semibold text-brand-ink-soft">Noch offen: {fehlt.join(" und ")}.</p>}
        </div>
      )}
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="form-success">{meldung.ok}</p>}
    </li>
  );
}
