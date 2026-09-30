"use client";

import { useActionState, useState, useTransition } from "react";
import { Music, Pencil, Trash2, X } from "lucide-react";
import { musikLoeschen, musikSpeichern } from "@/app/dashboard/musik/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { MUSIK_ARTEN, MUSIK_ART_LABEL, mb, type MusikTitel } from "@/lib/musik";
import type { GruppeAuswahl } from "@/components/musik/MusikHochladen";

const KNOPF = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-2.5 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50";

function Bearbeiten({ t, gruppen, fertig }: { t: MusikTitel; gruppen: GruppeAuswahl[]; fertig: () => void }) {
  const [ergebnis, aktion] = useActionState(async (p: AktionsErgebnis, fd: FormData) => {
    const r = await musikSpeichern(p, fd);
    if (!r.error) fertig();
    return r;
  }, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={t.id} />
      {t.verein_id && <input type="hidden" name="verein" value="1" />}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field sm:col-span-2">
          <span>Titel *</span>
          <input name="titel" required maxLength={120} defaultValue={t.titel} />
        </label>
        <label className="field">
          <span>Interpret / Quelle</span>
          <input name="interpret" maxLength={120} defaultValue={t.interpret ?? ""} />
        </label>
        <label className="field">
          <span>Verwendung</span>
          <select name="art" defaultValue={t.art}>
            {MUSIK_ARTEN.map((a) => (
              <option key={a} value={a}>
                {MUSIK_ART_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tempo (BPM)</span>
          <input name="bpm" type="number" min={20} max={300} defaultValue={t.bpm ?? ""} />
        </label>
        <label className="field sm:col-span-2 lg:col-span-3">
          <span>Notiz</span>
          <input name="notiz" maxLength={500} defaultValue={t.notiz ?? ""} placeholder="z. B. Schnitt ab 0:45, Einsatz nach 8 Takten" />
        </label>
      </div>
      {t.verein_id && gruppen.length > 0 && (
        <fieldset className="flex flex-wrap gap-x-3 gap-y-1.5">
          <legend className="mb-1 text-[12.5px] font-semibold text-brand-ink-soft">Gruppen (keine = ganzer Verein)</legend>
          {gruppen.map((g) => (
            <label key={g.id} className="inline-flex items-center gap-1.5 text-[13px] text-brand-ink">
              <input type="checkbox" name="gruppen" value={g.id} defaultChecked={t.gruppen.includes(g.id)} /> {g.name}
            </label>
          ))}
        </fieldset>
      )}
      <Meldung ergebnis={ergebnis} />
      <div className="flex gap-2">
        <SendenButton>Speichern</SendenButton>
        <button type="button" onClick={fertig} className={KNOPF}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

export function MusikTitelZeile({ t, url, darfVerwalten, gruppen }: { t: MusikTitel; url: string | null; darfVerwalten: boolean; gruppen: GruppeAuswahl[] }) {
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const gruppenNamen = t.gruppen.map((id) => gruppen.find((g) => g.id === id)?.name).filter(Boolean);
  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple-wash text-brand-purple">
            <Music size={18} />
          </span>
          <div className="min-w-0">
            <p className="break-words text-[14.5px] font-bold text-brand-ink">{t.titel}</p>
            <p className="text-[12.5px] text-brand-ink-soft">
              {[t.interpret, MUSIK_ART_LABEL[t.art], t.bpm ? `${t.bpm} BPM` : null, mb(t.groesse_bytes)].filter(Boolean).join(" · ")}
            </p>
            {t.verein_id && (
              <p className="text-[12px] text-brand-ink-soft">{gruppenNamen.length ? `Gruppen: ${gruppenNamen.join(", ")}` : "Für den ganzen Verein"}</p>
            )}
            {t.notiz && <p className="break-words text-[12.5px] text-brand-ink">{t.notiz}</p>}
          </div>
        </div>
        {url ? (
          <audio controls preload="none" src={url} className="h-10 w-full md:w-72" />
        ) : (
          <span className="text-[12px] text-brand-ink-soft">Wiedergabe gerade nicht möglich</span>
        )}
        {darfVerwalten && (
          <div className="flex shrink-0 gap-1.5">
            <button type="button" className={KNOPF} onClick={() => setOffen((v) => !v)} aria-label="Bearbeiten">
              {offen ? <X size={14} /> : <Pencil size={14} />}
            </button>
            <button
              type="button"
              disabled={laeuft}
              className={`${KNOPF} text-brand-red`}
              aria-label="Löschen"
              onClick={() => window.confirm(`„${t.titel}“ löschen?`) && starte(async () => setMeldung(await musikLoeschen(t.id)))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {offen && (
        <div className="rounded-xl border border-brand-line bg-brand-bg/60 p-3">
          <Bearbeiten t={t} gruppen={gruppen} fertig={() => setOffen(false)} />
        </div>
      )}
    </li>
  );
}
