"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { funktionAnlegen, funktionEntfernen, funktionLoeschen, funktionZuordnen } from "@/app/dashboard/verein/funktionen/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";

type Auswahl = { id: string; name: string };
export type VereinsFunktion = { id: string; name: string; mitglieder: Auswahl[] };

function Zuordnen({ funktion, mitglieder }: { funktion: VereinsFunktion; mitglieder: Auswahl[] }) {
  const [ergebnis, aktion] = useActionState(funktionZuordnen, LEERES_ERGEBNIS);
  const frei = mitglieder.filter((m) => !funktion.mitglieder.some((x) => x.id === m.id));
  return (
    <form action={aktion} className="flex flex-col gap-1.5">
      <input type="hidden" name="funktion_id" value={funktion.id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="field min-w-[180px] flex-1">
          <span>Person zuordnen</span>
          <select name="vm_id" defaultValue="" required>
            <option value="" disabled>
              Bitte wählen
            </option>
            {frei.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <SendenButton variante="sekundaer" laedtText="…">
          Zuordnen
        </SendenButton>
      </div>
      <Meldung ergebnis={ergebnis} />
    </form>
  );
}

export function FunktionenVerwaltung({
  vereinId,
  funktionen,
  mitglieder,
  darfVerwalten,
}: {
  vereinId: string;
  funktionen: VereinsFunktion[];
  mitglieder: Auswahl[];
  darfVerwalten: boolean;
}) {
  const [ergebnis, aktion] = useActionState(funktionAnlegen, LEERES_ERGEBNIS);
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {meldung && <Meldung ergebnis={meldung} />}
      {funktionen.length === 0 ? (
        <p className="rounded-xl bg-brand-bg px-4 py-5 text-[13.5px] text-brand-ink-soft">Noch keine Vereinsfunktionen angelegt.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {funktionen.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 rounded-xl border border-brand-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-bold text-brand-ink">{f.name}</p>
                {darfVerwalten && (
                  <button
                    type="button"
                    aria-label={`Funktion ${f.name} löschen`}
                    disabled={laeuft}
                    onClick={() => {
                      if (!confirm(`Funktion „${f.name}“ löschen? Die Personen bleiben Vereinsmitglieder.`)) return;
                      starte(async () => setMeldung(await funktionLoeschen(f.id)));
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-red-wash hover:text-brand-red"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {f.mitglieder.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {f.mitglieder.map((m) => (
                    <li key={m.id} className="inline-flex items-center gap-1 rounded-full bg-brand-bg px-3 py-1 text-[13px] text-brand-ink">
                      {m.name}
                      {darfVerwalten && (
                        <button
                          type="button"
                          aria-label={`${m.name} entfernen`}
                          disabled={laeuft}
                          onClick={() => starte(async () => setMeldung(await funktionEntfernen(f.id, m.id)))}
                          className="ml-1 text-brand-ink-soft hover:text-brand-red"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-brand-ink-soft">Noch niemand zugeordnet.</p>
              )}
              {darfVerwalten && <Zuordnen funktion={f} mitglieder={mitglieder} />}
            </li>
          ))}
        </ul>
      )}
      {darfVerwalten && (
        <form action={aktion} className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-brand-line p-3">
          <input type="hidden" name="verein_id" value={vereinId} />
          <label className="field min-w-[200px] flex-1">
            <span>Neue Funktion</span>
            <input name="name" placeholder="z. B. Vorstand, Hästräger, Musiker, Helfer" maxLength={60} required />
          </label>
          <SendenButton laedtText="…">Anlegen</SendenButton>
          <div className="w-full">
            <Meldung ergebnis={ergebnis} />
          </div>
        </form>
      )}
    </div>
  );
}
