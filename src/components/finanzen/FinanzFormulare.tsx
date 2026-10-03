"use client";

import { useActionState, useState, useTransition } from "react";
import { Bell, CheckCircle2, Paperclip, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { speicherVorpruefung } from "@/lib/speicher";
import {
  beitragBezahlt,
  beitragErinnern,
  beitragLoeschen,
  beitragOffen,
  beitraegeErzeugen,
  beitragsartLoeschen,
  beitragsartSpeichern,
  buchungLoeschen,
  buchungSpeichern,
} from "@/app/dashboard/finanzen/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import {
  BELEG_BUCKET,
  BELEG_MAX,
  KATEGORIEN_AUSGABE,
  KATEGORIEN_EINNAHME,
  RHYTHMEN,
  ZAHLUNGSARTEN,
  heuteBerlin,
  type Beitrag,
  type Beitragsart,
  type Buchung,
} from "@/lib/finanzen";

const KNOPF = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-2.5 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50";
const betragText = (n: number) => n.toFixed(2).replace(".", ",");

// ---------- Kassenbuch ----------
export function BuchungFormular({ vereinId, buchung, fertig }: { vereinId: string; buchung?: Buchung; fertig?: () => void }) {
  const [typ, setTyp] = useState<"einnahme" | "ausgabe">(buchung?.typ ?? "ausgabe");
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis>(LEERES_ERGEBNIS);
  const [laeuft, starte] = useTransition();
  const [runde, setRunde] = useState(0);

  function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const datei = fd.get("beleg") as File | null;
    fd.delete("beleg");
    starte(async () => {
      if (datei && datei.size > 0) {
        if (datei.size > BELEG_MAX) return setErgebnis({ error: "Der Beleg darf höchstens 10 MB groß sein." });
        const sicher = datei.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || "beleg";
        const pfad = `${vereinId}/${crypto.randomUUID()}/${sicher}`;
        const speicher = await speicherVorpruefung(createClient(), BELEG_BUCKET, pfad, datei.size);
        if (speicher) return setErgebnis({ error: speicher });
        const { error } = await createClient().storage.from(BELEG_BUCKET).upload(pfad, datei, { contentType: datei.type || "application/pdf", upsert: false });
        if (error) return setErgebnis({ error: "Beleg konnte nicht hochgeladen werden (PDF, JPG, PNG, WebP; max. 10 MB)." });
        fd.set("beleg_pfad", pfad);
        fd.set("beleg_name", datei.name.slice(0, 160));
      }
      const r = await buchungSpeichern(LEERES_ERGEBNIS, fd);
      setErgebnis(r);
      if (!r.error) {
        if (!buchung) setRunde((x) => x + 1);
        fertig?.();
      }
    });
  }

  const kategorien = typ === "einnahme" ? KATEGORIEN_EINNAHME : KATEGORIEN_AUSGABE;
  return (
    <form key={runde} onSubmit={absenden} className="flex flex-col gap-3">
      {buchung ? <input type="hidden" name="id" value={buchung.id} /> : <input type="hidden" name="verein_id" value={vereinId} />}
      <input type="hidden" name="typ" value={typ} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Art">
        {(["einnahme", "ausgabe"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={typ === t}
            onClick={() => setTyp(t)}
            className={`min-h-11 rounded-xl border-2 text-[14px] font-bold ${typ === t ? (t === "einnahme" ? "border-brand-green bg-brand-green-wash text-brand-green" : "border-brand-red bg-brand-red-wash text-brand-red") : "border-brand-line bg-white text-brand-ink"}`}
          >
            {t === "einnahme" ? "+ Einnahme" : "− Ausgabe"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field">
          <span>Datum *</span>
          <input name="datum" type="date" required defaultValue={buchung?.datum ?? heuteBerlin()} />
        </label>
        <label className="field">
          <span>Betrag (€) *</span>
          <input name="betrag" inputMode="decimal" required defaultValue={buchung ? betragText(buchung.betrag) : ""} placeholder="0,00" />
        </label>
        <label className="field">
          <span>Kategorie</span>
          <input name="kategorie" list={`kat-${typ}`} maxLength={60} defaultValue={buchung?.kategorie ?? ""} placeholder="z. B. Hallenmiete" />
          <datalist id={`kat-${typ}`}>
            {kategorien.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Zahlungsart</span>
          <select name="zahlungsart" defaultValue={buchung?.zahlungsart ?? "Überweisung"}>
            {ZAHLUNGSARTEN.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <label className="field sm:col-span-2 lg:col-span-3">
          <span>Beschreibung</span>
          <input name="beschreibung" maxLength={300} defaultValue={buchung?.beschreibung ?? ""} placeholder="z. B. Hallenmiete September, Startgeld Landesmeisterschaft" />
        </label>
        <label className="field">
          <span>{buchung?.beleg_pfad ? "Beleg ersetzen" : "Beleg (optional)"}</span>
          <input name="beleg" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="text-[12.5px]" />
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={laeuft} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-60">
          {laeuft ? "Wird gespeichert …" : buchung ? "Speichern" : "Buchen"}
        </button>
        {fertig && (
          <button type="button" onClick={fertig} className={KNOPF}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}

export function BuchungAktionen({ buchung, belegUrl }: { buchung: Buchung; belegUrl: string | null }) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-1.5">
        {belegUrl && (
          <a href={belegUrl} target="_blank" rel="noopener noreferrer" className={KNOPF} title={buchung.beleg_name ?? "Beleg"}>
            <Paperclip size={14} /> <span className="hidden sm:inline">Beleg</span>
          </a>
        )}
        {!buchung.beitrag_id && (
          <button type="button" className={KNOPF} onClick={() => setOffen((v) => !v)} aria-label="Bearbeiten">
            {offen ? <X size={14} /> : <Pencil size={14} />}
          </button>
        )}
        <button
          type="button"
          disabled={laeuft}
          className={`${KNOPF} text-brand-red`}
          aria-label="Löschen"
          onClick={() => window.confirm("Buchung löschen?") && starte(async () => setMeldung(await buchungLoeschen(buchung.id)))}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {offen && (
        <div className="w-full rounded-xl border border-brand-line bg-brand-bg/60 p-3 text-left">
          <BuchungFormular vereinId={buchung.verein_id} buchung={buchung} fertig={() => setOffen(false)} />
        </div>
      )}
    </div>
  );
}

// ---------- Beitragsarten ----------
export function BeitragsartFormular({ vereinId, art, fertig }: { vereinId: string; art?: Beitragsart; fertig?: () => void }) {
  const [runde, setRunde] = useState(0);
  const [ergebnis, aktion] = useActionState(async (p: AktionsErgebnis, fd: FormData) => {
    const r = await beitragsartSpeichern(p, fd);
    if (!r.error) {
      if (!art) setRunde((x) => x + 1);
      fertig?.();
    }
    return r;
  }, LEERES_ERGEBNIS);
  return (
    <form key={runde} action={aktion} className="flex flex-col gap-2">
      {art ? <input type="hidden" name="id" value={art.id} /> : <input type="hidden" name="verein_id" value={vereinId} />}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="field">
          <span>Name *</span>
          <input name="name" required maxLength={80} defaultValue={art?.name} placeholder="z. B. Jahresbeitrag Aktive, Kinder, Familie" />
        </label>
        <label className="field">
          <span>Betrag (€) *</span>
          <input name="betrag" inputMode="decimal" required defaultValue={art ? betragText(art.betrag) : ""} placeholder="0,00" />
        </label>
        <label className="field">
          <span>Rhythmus</span>
          <select name="rhythmus" defaultValue={art?.rhythmus ?? "jährlich"}>
            {RHYTHMEN.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-2 rounded-xl border border-brand-line p-3">
        <label className="inline-flex items-start gap-2 text-[13px] text-brand-ink">
          <input type="checkbox" name="automatisch" value="1" defaultChecked={art?.automatisch ?? false} className="mt-0.5" />
          <span>
            <strong>Automatisch anlegen</strong> – TanzRaum legt die Beiträge für alle aktiven Mitglieder (ohne Eltern-Rolle) 14 Tage vor der
            Fälligkeit an und rückt danach im gewählten Rhythmus weiter.
          </span>
        </label>
        <label className="field sm:max-w-[240px]">
          <span>Nächste Fälligkeit</span>
          <input name="naechste_faelligkeit" type="date" defaultValue={art?.naechste_faelligkeit ?? ""} />
        </label>
        <p className="text-[12px] text-brand-ink-soft">Mitglieder und verknüpfte Eltern werden am Fälligkeitstag und – falls noch offen – 7 Tage später automatisch erinnert.</p>
      </fieldset>
      {art && (
        <label className="inline-flex items-center gap-2 text-[13px] text-brand-ink">
          <input type="hidden" name="aktiv_gesetzt" value="1" />
          <input type="checkbox" name="aktiv" value="1" defaultChecked={art.aktiv} /> aktiv
          (bei der Sollstellung wählbar)
        </label>
      )}
      <Meldung ergebnis={ergebnis} />
      <div className="flex gap-2">
        <SendenButton>{art ? "Speichern" : "Beitragsart anlegen"}</SendenButton>
        {fertig && (
          <button type="button" onClick={fertig} className={KNOPF}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}

export function BeitragsartAktionen({ art, vereinId }: { art: Beitragsart; vereinId: string }) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end gap-1.5">
        <button type="button" className={KNOPF} onClick={() => setOffen((v) => !v)} aria-label="Bearbeiten">
          {offen ? <X size={14} /> : <Pencil size={14} />}
        </button>
        <button
          type="button"
          disabled={laeuft}
          className={`${KNOPF} text-brand-red`}
          aria-label="Löschen"
          onClick={() => window.confirm(`Beitragsart „${art.name}“ löschen? Bestehende Beiträge bleiben erhalten.`) && starte(async () => setMeldung(await beitragsartLoeschen(art.id)))}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {offen && (
        <div className="rounded-xl border border-brand-line bg-brand-bg/60 p-3">
          <BeitragsartFormular vereinId={vereinId} art={art} fertig={() => setOffen(false)} />
        </div>
      )}
    </div>
  );
}

// ---------- Beitraege ----------
export function SollstellungFormular({ arten, personen }: { arten: Beitragsart[]; personen: { vmId: string; name: string; rolle: string }[] }) {
  const [fuer, setFuer] = useState<"alle" | "auswahl">("alle");
  const [ergebnis, aktion] = useActionState(beitraegeErzeugen, LEERES_ERGEBNIS);
  if (arten.length === 0) return <p className="text-[13px] text-brand-ink-soft">Lege zuerst eine Beitragsart an (Reiter „Beitragsarten“).</p>;
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="fuer" value={fuer} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="field">
          <span>Beitragsart *</span>
          <select name="typ" required defaultValue="">
            <option value="" disabled>
              – wählen –
            </option>
            {arten.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({betragText(a.betrag)} €, {a.rhythmus})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Fällig am *</span>
          <input name="faellig" type="date" required />
        </label>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Für wen">
        {(
          [
            ["alle", "Alle aktiven Mitglieder (ohne Eltern-Konten)"],
            ["auswahl", "Ausgewählte Personen"],
          ] as const
        ).map(([w, l]) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={fuer === w}
            onClick={() => setFuer(w)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${fuer === w ? "bg-brand-ink text-white" : "bg-brand-bg text-brand-ink hover:bg-brand-line"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {fuer === "auswahl" && (
        <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-brand-line p-2 sm:grid-cols-2 lg:grid-cols-3">
          {personen.map((p) => (
            <label key={p.vmId} className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[13px] text-brand-ink hover:bg-brand-bg">
              <input type="checkbox" name="personen" value={p.vmId} /> <span className="min-w-0 truncate">{p.name}</span>
              <span className="ml-auto shrink-0 text-[11.5px] text-brand-ink-soft">{p.rolle}</span>
            </label>
          ))}
        </div>
      )}
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton laedtText="Wird angelegt …">Beiträge anlegen</SendenButton>
      </div>
      <p className="text-[12px] text-brand-ink-soft">Doppelte werden übersprungen: Pro Person, Beitragsart und Fälligkeit gibt es nur einen Beitrag.</p>
    </form>
  );
}

function BezahltFormular({ beitrag, fertig }: { beitrag: Beitrag; fertig: () => void }) {
  const [ergebnis, aktion] = useActionState(async (p: AktionsErgebnis, fd: FormData) => {
    const r = await beitragBezahlt(p, fd);
    if (!r.error) fertig();
    return r;
  }, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={beitrag.id} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="field">
          <span>Bezahlt am</span>
          <input name="datum" type="date" defaultValue={heuteBerlin()} />
        </label>
        <label className="field">
          <span>Zahlungsweg</span>
          <select name="zahlungsweg" defaultValue={beitrag.zahlungsweg || "Überweisung"}>
            {ZAHLUNGSARTEN.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="inline-flex items-center gap-2 text-[13px] text-brand-ink">
        <input type="checkbox" name="kassenbuch" value="1" defaultChecked /> Als Einnahme ins Kassenbuch übernehmen
      </label>
      <Meldung ergebnis={ergebnis} />
      <div className="flex gap-2">
        <SendenButton>Als bezahlt markieren</SendenButton>
        <button type="button" onClick={fertig} className={KNOPF}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

export function BeitragAktionen({ beitrag }: { beitrag: Beitrag }) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const aktion = (f: () => Promise<AktionsErgebnis>) => starte(async () => setMeldung(await f()));
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {beitrag.bezahlt ? (
          <button type="button" disabled={laeuft} className={KNOPF} onClick={() => window.confirm("Wieder auf offen setzen? Eine automatisch angelegte Kassenbuch-Buchung wird entfernt.") && aktion(() => beitragOffen(beitrag.id))}>
            <RotateCcw size={14} /> <span className="hidden sm:inline">Wieder offen</span>
          </button>
        ) : (
          <>
            <button type="button" className={`${KNOPF} text-brand-green`} onClick={() => setOffen((v) => !v)}>
              <CheckCircle2 size={14} /> Bezahlt
            </button>
            <button type="button" disabled={laeuft} className={KNOPF} onClick={() => aktion(() => beitragErinnern(beitrag.id))} title="Erinnerung per Benachrichtigung">
              <Bell size={14} /> <span className="hidden sm:inline">Erinnern</span>
            </button>
          </>
        )}
        <button
          type="button"
          disabled={laeuft}
          className={`${KNOPF} text-brand-red`}
          aria-label="Löschen"
          onClick={() => window.confirm("Beitrag löschen?") && aktion(() => beitragLoeschen(beitrag.id))}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {meldung && <Meldung ergebnis={meldung} />}
      {offen && (
        <div className="w-full rounded-xl border border-brand-line bg-brand-bg/60 p-3 text-left">
          <BezahltFormular beitrag={beitrag} fertig={() => setOffen(false)} />
        </div>
      )}
    </div>
  );
}
