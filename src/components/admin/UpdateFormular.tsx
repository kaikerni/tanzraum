"use client";

import { useActionState, useState, useTransition } from "react";
import { updateAnlegen, updateSchalten } from "@/app/dashboard/admin/updates/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import { BildAuswahl } from "./AnkuendigungFormular";
import { UPDATE_KATEGORIEN } from "@/lib/updates/getUpdates";

// „+ Update erstellen“ – Release-Information fuer Landingpage, „Was ist neu?“ und Kai
export function UpdateFormular({ version }: { version: string }) {
  const [runde, setRunde] = useState(0);
  const [ergebnis, aktion] = useActionState(async (prev: typeof LEERES_ERGEBNIS, fd: FormData) => {
    const d = String(fd.get("datum_lokal") ?? "");
    fd.set("datum", d ? new Date(`${d}T08:00`).toISOString() : "");
    const r = await updateAnlegen(prev, fd);
    if (!r.error) setRunde((x) => x + 1);
    return r;
  }, LEERES_ERGEBNIS);

  return (
    <form key={runde} action={aktion} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="field">
          <span>Version</span>
          <input name="version" defaultValue={version} pattern="\d+\.\d+\.\d+" placeholder="1.2.0" />
        </label>
        <label className="field">
          <span>Kategorie</span>
          <select name="kategorie" defaultValue="neue_funktion">
            {UPDATE_KATEGORIEN.map((k) => (
              <option key={k.wert} value={k.wert}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Datum (leer = heute)</span>
          <input type="date" name="datum_lokal" />
        </label>
      </div>
      <label className="field">
        <span>Titel</span>
        <input name="titel" required maxLength={150} placeholder="z. B. Neue Gruppenverwaltung" />
      </label>
      <label className="field">
        <span>Kurzbeschreibung (Landingpage, Dashboard, Kai)</span>
        <input name="kurztext" required maxLength={300} placeholder="z. B. Gruppen lassen sich jetzt Schritt für Schritt anlegen." />
      </label>
      <label className="field">
        <span>Ausführliche Beschreibung</span>
        <textarea name="text" rows={5} maxLength={5000} />
      </label>
      <BildAuswahl />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="field">
          <span>Buttonziel (optional): Pfad in TanzRaum oder https-Link</span>
          <input name="link_url" maxLength={500} placeholder="/dashboard/verein oder https://…" />
        </label>
        <label className="field">
          <span>Buttontext</span>
          <input name="link_text" maxLength={40} placeholder="z. B. Gruppen ansehen" />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2 rounded-xl border border-brand-line px-3.5 py-3">
        <legend className="px-1 text-[13px] font-semibold text-brand-ink">Anzeigen</legend>
        <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
          <input type="checkbox" name="auf_landingpage" /> Landingpage („✨ Neu bei TanzRaum“, öffentlich)
        </label>
        <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
          <input type="checkbox" name="im_benutzerbereich" defaultChecked /> Eingeloggter Bereich („Was ist neu?“ und Dashboard)
        </label>
        <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
          <input type="checkbox" name="wichtig" /> Wichtig (oben einsortiert – ohne Popup)
        </label>
        <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
          <input type="checkbox" name="kai_hinweis" /> Kai darf darauf hinweisen (roter Punkt am „Kai – Hilfe?“-Knopf, öffnet sich nie selbst)
        </label>
      </fieldset>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird veröffentlicht …">Update veröffentlichen</SendenButton>
    </form>
  );
}

const LABEL: Record<string, string> = {
  auf_landingpage: "Landingpage",
  im_benutzerbereich: "Benutzerbereich",
  wichtig: "Wichtig",
  kai_hinweis: "Kai-Hinweis",
};

export function UpdateSchalter({ id, werte }: { id: string; werte: Record<"auf_landingpage" | "im_benutzerbereich" | "wichtig" | "kai_hinweis", boolean> }) {
  const [stand, setStand] = useState(werte);
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[12px]">
      {(Object.keys(LABEL) as (keyof typeof werte)[]).map((f) => (
        <button
          key={f}
          type="button"
          disabled={laeuft}
          aria-pressed={stand[f]}
          onClick={() =>
            starte(async () => {
              const r = await updateSchalten(id, f, !stand[f]);
              if (r.error) setFehler(r.error);
              else setStand((s) => ({ ...s, [f]: !s[f] }));
            })
          }
          className={`min-h-8 rounded-full border px-2.5 font-semibold ${stand[f] ? "border-brand-green/40 bg-brand-green-wash text-brand-green" : "border-brand-line text-brand-ink-soft"}`}
        >
          {stand[f] ? "✓ " : ""}
          {LABEL[f]}
        </button>
      ))}
      {fehler && <span className="text-brand-red">{fehler}</span>}
    </span>
  );
}
