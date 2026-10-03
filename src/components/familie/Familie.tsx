"use client";

import { useActionState, useState, useTransition } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import {
  elternCodeErzeugen,
  elternVerknuepfungAufheben,
  elternVerknuepfungEntscheiden,
  kindEinstellungSetzen,
  kindVerknuepfen,
} from "@/app/dashboard/einstellungen/familie-actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import type { Elternteil, Kind, MeineSchutzEinstellungen } from "@/lib/familie/getFamilie";

// ---------- Sicht des Kindes ----------
export function ElternCode({ eltern, schutz }: { eltern: Elternteil[]; schutz: MeineSchutzEinstellungen }) {
  const [code, setCode] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] text-brand-ink-soft">
        Deine Eltern können sich mit deinem Konto verknüpfen. Erzeuge dazu einen Code und gib ihn nur deiner Mutter oder deinem
        Vater. Bist du in einem Verein, bestätigt der Verein die Verknüpfung zusätzlich.
      </p>
      {eltern.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {eltern.map((e) => (
            <li key={e.verknuepfungId} className="flex items-center justify-between gap-2 rounded-xl bg-brand-bg px-3 py-2 text-[13.5px]">
              <span className="font-semibold text-brand-ink">{e.anzeige}</span>
              <span className={`status-badge ${e.status === "bestaetigt" ? "zugesagt" : "offen"}`}>
                {e.status === "bestaetigt" ? "Verknüpft" : "Wartet auf den Verein"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {code ? (
        <div className="rounded-xl border-2 border-dashed border-brand-red/40 bg-brand-red-wash px-4 py-3 text-center">
          <p className="text-[12.5px] text-brand-ink-soft">Dein Eltern-Code (30 Minuten gültig)</p>
          <p className="font-mono text-[26px] font-extrabold tracking-[0.2em] text-brand-ink">{code.slice(0, 4)}-{code.slice(4)}</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={laeuft}
          onClick={() =>
            starte(async () => {
              const r = await elternCodeErzeugen();
              setMeldung(r.error ? r : null);
              if (r.code) setCode(r.code);
            })
          }
          className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-brand-line px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-60"
        >
          <KeyRound size={16} /> Code für meine Eltern erzeugen
        </button>
      )}
      {meldung && <Meldung ergebnis={meldung} />}
      <div className="rounded-xl bg-brand-bg px-3 py-2.5 text-[13px] text-brand-ink-soft">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-brand-ink">
          <ShieldCheck size={15} /> {schutz.hatEltern ? "Von deinen Eltern festgelegt" : "Schutzeinstellungen für Kinderkonten unter 16"}
        </p>
        <p>Nachrichten: {schutz.nachrichtenErlaubt ? "mit deinem Verein und deinen Eltern" : "deaktiviert"}</p>
        <p>TanzRaum Map: {schutz.mapErlaubt ? "erlaubt (wenn du es einschaltest)" : "ausgeschaltet"}</p>
        <p>Spotlights: {schutz.spotlightsNurKontakte ? "nur Verein & Kontakte" : "wie du es beim Erstellen wählst"}</p>
        <p>Push-Benachrichtigungen: {schutz.pushErlaubt ? "erlaubt" : "nicht erlaubt"}</p>
        {!schutz.hatEltern && <p className="mt-1">Mit einem verknüpften Elternkonto können deine Eltern diese Einstellungen ändern.</p>}
      </div>
    </div>
  );
}

// ---------- Sicht der Eltern ----------
export function KindVerknuepfen() {
  const [ergebnis, aktion] = useActionState(kindVerknuepfen, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <p className="text-[13.5px] text-brand-ink-soft">
        Hat dein Kind schon ein TanzRaum-Konto? Lass dir in seinem Konto unter Einstellungen → Familie einen Eltern-Code
        erzeugen und gib ihn hier ein.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="field min-w-[180px] flex-1">
          <span>Eltern-Code</span>
          <input name="code" placeholder="XXXX-XXXX" autoComplete="off" maxLength={9} className="font-mono uppercase tracking-widest" required />
        </label>
        <SendenButton laedtText="Wird verknüpft …">Verknüpfen</SendenButton>
      </div>
      <Meldung ergebnis={ergebnis} />
    </form>
  );
}

function Schalter({ kind, feld, wert, titel, text }: { kind: Kind; feld: string; wert: boolean; titel: string; text: string }) {
  const [an, setAn] = useState(wert);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1.5">
      <span className="text-[13.5px] text-brand-ink">
        <strong>{titel}</strong>
        <br />
        <span className="text-brand-ink-soft">{text}</span>
        {fehler && <span className="form-error mt-1 block">{fehler}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={an}
        disabled={laeuft}
        onChange={(e) => {
          const neu = e.target.checked;
          setAn(neu);
          starte(async () => {
            const r = await kindEinstellungSetzen(kind.kindId, feld, neu);
            if (r.error) {
              setAn(!neu);
              setFehler(r.error);
            } else setFehler(null);
          });
        }}
        className="mt-1 h-5 w-5 shrink-0 accent-brand-red"
      />
    </label>
  );
}

export function MeineKinder({ kinder }: { kinder: Kind[] }) {
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  if (kinder.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {meldung && <Meldung ergebnis={meldung} />}
      {kinder.map((k) => (
        <div key={k.kindId} className="rounded-xl border border-brand-line p-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-bold text-brand-ink">{k.anzeige}</p>
            <span className={`status-badge ${k.status === "bestaetigt" ? "zugesagt" : "offen"}`}>
              {k.status === "bestaetigt" ? (k.quelle === "verein" ? "Vom Verein zugeordnet" : "Verknüpft") : "Wartet auf den Verein"}
            </span>
          </div>
          {k.status === "bestaetigt" && !k.unter16 ? (
            <p className="text-[13px] text-brand-ink-soft">Ab 16 Jahren verwaltet dein Kind sein Konto selbst – die Schutzeinstellungen gelten nicht mehr.</p>
          ) : k.status === "bestaetigt" ? (
            <div className="divide-y divide-brand-line">
              <Schalter
                kind={k}
                feld="nachrichten_erlaubt"
                wert={k.nachrichtenErlaubt}
                titel="💬 Nachrichten für mein Kind erlauben"
                text="Aus: keine neuen oder bestehenden Privatchats (außer mit dir), in Gruppenchats nur lesen. Die Jugendschutzregeln gelten immer zusätzlich."
              />
              <Schalter
                kind={k}
                feld="map_erlaubt"
                wert={k.mapErlaubt}
                titel="🗺️ Mein Kind darf auf der TanzRaum Map erscheinen"
                text="Standard: aus. Nur wenn dein Kind es zusätzlich selbst einschaltet – immer nur mit Ort, nie mit Straße oder Adresse."
              />
              <Schalter
                kind={k}
                feld="spotlights_nur_kontakte"
                wert={k.spotlightsNurKontakte}
                titel="✨ Spotlights nur für Verein & Kontakte"
                text="An (Standard): Spotlights deines Kindes sehen nur Mitglieder seines Vereins und seine Kontakte."
              />
              <Schalter
                kind={k}
                feld="push_erlaubt"
                wert={k.pushErlaubt}
                titel="🔔 Push-Benachrichtigungen erlauben"
                text="Deine Einwilligung, dass dein Kind Push-Benachrichtigungen auf seinen Geräten einschalten darf. Aus: keine Push-Benachrichtigungen."
              />
            </div>
          ) : (
            <p className="text-[13px] text-brand-ink-soft">Die Einstellungen sind verfügbar, sobald der Verein die Verknüpfung bestätigt hat.</p>
          )}
          {k.quelle === "code" && k.verknuepfungId && (
            <button
              type="button"
              disabled={laeuft}
              onClick={() => {
                if (!confirm(`Verknüpfung mit ${k.anzeige} aufheben? Deine Einstellungen für dein Kind werden dabei zurückgesetzt.`)) return;
                starte(async () => setMeldung(await elternVerknuepfungAufheben(k.verknuepfungId!)));
              }}
              className="mt-2 text-[12.5px] font-semibold text-brand-red"
            >
              Verknüpfung aufheben
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- Vereinsadmin: Bestaetigung ----------
export function ElternBestaetigungen({ offen }: { offen: { id: string; eltern: string; kind: string }[] }) {
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {meldung && <Meldung ergebnis={meldung} />}
      {offen.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-bg px-3 py-2 text-[13.5px]">
          <span>
            <strong>{o.eltern}</strong> möchte sich als Elternteil mit <strong>{o.kind}</strong> verknüpfen.
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              disabled={laeuft}
              onClick={() => starte(async () => setMeldung(await elternVerknuepfungEntscheiden(o.id, true)))}
              className="min-h-9 rounded-lg bg-brand-red px-3 text-[13px] font-semibold text-white"
            >
              Bestätigen
            </button>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => starte(async () => setMeldung(await elternVerknuepfungEntscheiden(o.id, false)))}
              className="min-h-9 rounded-lg border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink"
            >
              Ablehnen
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
