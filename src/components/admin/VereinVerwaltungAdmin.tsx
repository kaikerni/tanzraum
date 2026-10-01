"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Copy, Check } from "lucide-react";
import { vereinAnlegenAdmin, lizenzSetzenAdmin, lizenzBeendenAdmin, vereinsadminEinladen, einladungWiderrufenAdmin } from "@/app/dashboard/admin/vereine/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";

// „+ Verein anlegen“ (TanzRaum-Administration) – danach Lizenz und Vereinsadmin auf der Vereinsseite
export function VereinAnlegenAdmin() {
  const [offen, setOffen] = useState(false);
  const [ergebnis, aktion] = useActionState(vereinAnlegenAdmin, LEERES_ERGEBNIS);
  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-brand-red px-4 text-[14px] font-semibold text-white hover:bg-brand-red-deep"
      >
        <Plus size={17} /> Verein anlegen
      </button>
    );
  }
  return (
    <form action={aktion} className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5">
      <h2 className="text-[16px] font-bold text-brand-ink">Verein anlegen</h2>
      <p className="text-[13px] text-brand-ink-soft">
        Der Verein wird ohne Mitglieder angelegt. Danach Lizenz auswählen und den Vereinsadmin einladen – er registriert sich selbst.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="field">
          <span>Vereinsname</span>
          <input name="name" required maxLength={120} placeholder="z. B. Cannstatter Quellenclub" />
        </label>
        <label className="field">
          <span>Kürzel</span>
          <input name="kuerzel" maxLength={20} />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[3fr_1fr_1fr_2fr]">
        <label className="field">
          <span>Straße</span>
          <input name="strasse" />
        </label>
        <label className="field">
          <span>Nr.</span>
          <input name="hausnummer" />
        </label>
        <label className="field">
          <span>PLZ</span>
          <input name="plz" inputMode="numeric" />
        </label>
        <label className="field">
          <span>Ort</span>
          <input name="ort" />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>E-Mail des Vereins</span>
          <input name="email" type="email" />
        </label>
        <label className="field">
          <span>Telefon</span>
          <input name="telefon" />
        </label>
        <label className="field">
          <span>Webseite</span>
          <input name="webseite" />
        </label>
        <label className="field">
          <span>Ansprechpartner</span>
          <input name="ansprechpartner" />
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div className="flex gap-2">
        <SendenButton laedtText="Wird angelegt …">Verein erstellen</SendenButton>
        <button type="button" onClick={() => setOffen(false)} className="rounded-xl px-4 text-[13.5px] text-brand-ink-soft hover:bg-brand-bg">
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// Lizenz manuell aktivieren: Vereinslizenz, Preis (0 € = kostenlos, z. B. Pilot), Laufzeit, Status – Ende = Start + Laufzeit
export function LizenzManuell({ vereinId, heute, manuellAktiv }: { vereinId: string; heute: string; manuellAktiv: boolean }) {
  const [ergebnis, aktion] = useActionState(lizenzSetzenAdmin, LEERES_ERGEBNIS);
  const [laeuft, starte] = useTransition();
  const [beendet, setBeendet] = useState<AktionsErgebnis | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <form action={aktion} className="flex flex-col gap-3">
        <input type="hidden" name="verein_id" value={vereinId} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="field">
            <span>Lizenz</span>
            <select name="lizenz" defaultValue="verein" disabled>
              <option value="verein">Verein</option>
            </select>
          </label>
          <label className="field">
            <span>Preis (€)</span>
            <input name="preis" defaultValue="0" inputMode="decimal" required />
          </label>
          <label className="field">
            <span>Laufzeit</span>
            <select name="monate" defaultValue="12">
              <option value="1">1 Monat</option>
              <option value="3">3 Monate</option>
              <option value="6">6 Monate</option>
              <option value="12">1 Jahr</option>
              <option value="24">2 Jahre</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue="active">
              <option value="active">Aktiv</option>
              <option value="trialing">Test</option>
            </select>
          </label>
        </div>
        <label className="field max-w-[220px]">
          <span>Start</span>
          <input type="date" name="start" defaultValue={heute} max={heute} required />
        </label>
        <p className="text-[12.5px] text-brand-ink-soft">Ende = Start + Laufzeit. Eine laufende bezahlte Lizenz (Karte, PayPal, Überweisung) wird nicht überschrieben.</p>
        <Meldung ergebnis={ergebnis} />
        <div>
          <SendenButton laedtText="Wird aktiviert …">Lizenz aktivieren</SendenButton>
        </div>
      </form>
      {manuellAktiv && (
        <div className="flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
          <button
            type="button"
            disabled={laeuft}
            onClick={() => {
              if (confirm("Manuelle Lizenz jetzt beenden? Der Verein verliert die Vereinsfunktionen.")) starte(async () => setBeendet(await lizenzBeendenAdmin(vereinId)));
            }}
            className="text-[13px] font-semibold text-brand-red hover:underline disabled:opacity-60"
          >
            Manuelle Lizenz deaktivieren
          </button>
          {beendet && <Meldung ergebnis={beendet} />}
        </div>
      )}
    </div>
  );
}

export type AdminEinladung = { id: string; email: string | null; erstellt_am: string; gueltig_bis: string | null; status: string; token: string | null };

const STATUS: Record<string, string> = { offen: "offen", angenommen: "angenommen", abgelaufen: "abgelaufen", widerrufen: "widerrufen" };

function KopierKnopf({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          /* Kopieren nicht moeglich */
        }
      }}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg"
    >
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? "Kopiert" : "Link kopieren"}
    </button>
  );
}

// Vereinsadmin einladen: Einladung ≠ Konto – die Person registriert sich selbst und nimmt die Einladung dann an
export function VereinsadminEinladung({ vereinId, basis, einladungen, lizenzAktiv }: { vereinId: string; basis: string; einladungen: AdminEinladung[]; lizenzAktiv: boolean }) {
  const [ergebnis, aktion] = useActionState(vereinsadminEinladen, LEERES_ERGEBNIS as AktionsErgebnis & { link?: string });
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <form action={aktion} className="flex flex-col gap-3">
        <input type="hidden" name="verein_id" value={vereinId} />
        <label className="field">
          <span>E-Mail des zukünftigen Vereinsadmins</span>
          <input name="email" type="email" required placeholder="admin@verein.de" />
        </label>
        <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
          <input type="checkbox" name="senden" defaultChecked={lizenzAktiv} disabled={!lizenzAktiv} /> Einladung per E-Mail senden
          {!lizenzAktiv && <span className="text-[12px] text-brand-ink-soft">(erst mit aktiver Lizenz)</span>}
        </label>
        <Meldung ergebnis={ergebnis} />
        {ergebnis.link && (
          <div className="flex flex-col gap-2 rounded-xl bg-brand-bg px-3.5 py-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all text-[12.5px] text-brand-ink">{ergebnis.link}</code>
            <KopierKnopf text={ergebnis.link} />
          </div>
        )}
        <div>
          <SendenButton laedtText="Wird erstellt …">Vereinsadmin einladen</SendenButton>
        </div>
      </form>
      {einladungen.length > 0 && (
        <ul className="flex flex-col divide-y divide-brand-line">
          {einladungen.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 basis-full text-[13.5px] text-brand-ink [overflow-wrap:anywhere] sm:basis-auto sm:flex-1">
                {e.email ?? "ohne E-Mail"}
                <span className="block text-[12px] text-brand-ink-soft">
                  {new Date(e.erstellt_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                  {e.gueltig_bis ? ` · gültig bis ${new Date(e.gueltig_bis).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}` : ""}
                </span>
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                  e.status === "angenommen" ? "bg-brand-green-wash text-brand-green" : e.status === "offen" ? "bg-brand-gold-wash text-brand-gold" : "bg-brand-bg text-brand-ink-soft"
                }`}
              >
                {STATUS[e.status] ?? e.status}
              </span>
              {e.token && <KopierKnopf text={`${basis}/einladung/${e.token}`} />}
              {e.status === "offen" && (
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => starte(async () => setFehler((await einladungWiderrufenAdmin(e.id, vereinId)).error))}
                  className="text-[12.5px] font-semibold text-brand-red hover:underline"
                >
                  Widerrufen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {fehler && <p className="form-error">{fehler}</p>}
    </div>
  );
}
