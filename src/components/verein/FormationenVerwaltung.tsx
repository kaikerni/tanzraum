"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2, UserMinus, AlertTriangle } from "lucide-react";
import {
  formationLoeschen,
  formationMitgliedEntfernen,
  formationMitgliedHinzufuegen,
  formationSpeichern,
} from "@/app/dashboard/verein/formationen/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";
import type { Disziplin, Formation } from "@/lib/verein/formationen";

type Auswahl = { id: string; name: string };

const BESETZUNG: Record<Disziplin["besetzung"], string> = { solo: "1 Person", paar: "2 Personen", gruppe: "Gruppe" };

function FormationFormular({
  vereinId,
  formation,
  disziplinen,
  altersklassen,
  erlaubt,
  gruppen,
  fertig,
}: {
  vereinId: string;
  formation?: Formation;
  disziplinen: Disziplin[];
  altersklassen: Auswahl[];
  erlaubt: Record<string, string[]>;
  gruppen: Auswahl[];
  fertig?: () => void;
}) {
  const [ergebnis, aktion] = useActionState(async (p: AktionsErgebnis, fd: FormData) => {
    const r = await formationSpeichern(p, fd);
    if (!r.error) fertig?.();
    return r;
  }, LEERES_ERGEBNIS);
  const [altersklasse, setAltersklasse] = useState(formation?.altersklasseId ?? "");
  const [disziplin, setDisziplin] = useState(formation?.disziplinId ?? "");
  const moeglich = altersklasse ? disziplinen.filter((d) => erlaubt[altersklasse]?.includes(d.id)) : disziplinen;
  const mitThema = disziplinen.find((d) => d.id === disziplin)?.mitThema ?? false;
  return (
    <form action={aktion} className="auth-form">
      <input type="hidden" name="verein_id" value={vereinId} />
      {formation && <input type="hidden" name="id" value={formation.id} />}
      <label className="field">
        <span>Name der Formation</span>
        <input name="name" defaultValue={formation?.name ?? ""} placeholder="z. B. Tanzpaar Anna & Max, Jugendgarde" maxLength={120} required />
      </label>
      <div className="field-row flex-wrap">
        <label className="field">
          <span>Altersklasse (optional)</span>
          <select name="altersklasse_id" value={altersklasse} onChange={(e) => setAltersklasse(e.target.value)}>
            <option value="">– keine –</option>
            {altersklassen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Disziplin</span>
          <select name="disziplin_id" value={disziplin} onChange={(e) => setDisziplin(e.target.value)} required>
            <option value="">Bitte wählen</option>
            {moeglich.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({BESETZUNG[d.besetzung]})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Vereinsgruppe (optional)</span>
          <select name="gruppe_id" defaultValue={formation?.gruppeId ?? ""}>
            <option value="">– keine –</option>
            {gruppen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mitThema && (
        <label className="field">
          <span>Thema (optional)</span>
          <input name="thema" defaultValue={formation?.thema ?? ""} placeholder="z. B. Die Reise durch die Zeit" maxLength={300} />
        </label>
      )}
      {formation && (
        <label className="flex items-center gap-2 text-[13px] text-brand-ink">
          <input type="hidden" name="aktiv_feld" value="1" />
          <input type="checkbox" name="aktiv" value="ja" defaultChecked={formation.aktiv} className="h-4 w-4 accent-brand-red" />
          aktiv
        </label>
      )}
      <Meldung ergebnis={ergebnis} />
      <SendenButton>{formation ? "Speichern" : "Formation anlegen"}</SendenButton>
    </form>
  );
}

function MitgliedHinzufuegen({ formation, mitglieder }: { formation: Formation; mitglieder: Auswahl[] }) {
  const [ergebnis, aktion] = useActionState(formationMitgliedHinzufuegen, LEERES_ERGEBNIS);
  const frei = mitglieder.filter((m) => !formation.mitglieder.some((x) => x.vmId === m.id));
  const voll = (formation.besetzung === "solo" && formation.mitglieder.length >= 1) || (formation.besetzung === "paar" && formation.mitglieder.length >= 2);
  if (voll) return null;
  return (
    <form action={aktion} className="flex flex-col gap-2">
      <input type="hidden" name="formation_id" value={formation.id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="field min-w-[180px] flex-1">
          <span>Mitglied hinzufügen</span>
          <select name="vm_id" required defaultValue="">
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
        {formation.besetzung !== "gruppe" && (
          <label className="field min-w-[140px] flex-1">
            <span>Auftrittsname (optional)</span>
            <input name="auftrittsname" maxLength={80} />
          </label>
        )}
        <SendenButton variante="sekundaer" laedtText="…">
          Hinzufügen
        </SendenButton>
      </div>
      <Meldung ergebnis={ergebnis} />
    </form>
  );
}

function FormationKarte({
  vereinId,
  formation,
  darfVerwalten,
  mitglieder,
  disziplinen,
  altersklassen,
  erlaubt,
  gruppen,
}: {
  vereinId: string;
  formation: Formation;
  darfVerwalten: boolean;
  mitglieder: Auswahl[];
  disziplinen: Disziplin[];
  altersklassen: Auswahl[];
  erlaubt: Record<string, string[]>;
  gruppen: Auswahl[];
}) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  return (
    <li className={`flex flex-col gap-2 rounded-xl border border-brand-line p-3 ${formation.aktiv ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-brand-ink">{formation.name}</p>
          <p className="text-[12.5px] text-brand-ink-soft">
            {[formation.disziplin, formation.altersklasse, formation.gruppe ? `Gruppe ${formation.gruppe}` : null, formation.aktiv ? null : "inaktiv"]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {formation.thema && <p className="text-[12.5px] text-brand-ink">Thema: „{formation.thema}“</p>}
        </div>
        {darfVerwalten && (
          <div className="flex gap-1">
            <button type="button" onClick={() => setBearbeiten((b) => !b)} className="text-[12.5px] font-semibold text-brand-red">
              {bearbeiten ? "Schließen" : "Bearbeiten"}
            </button>
            <button
              type="button"
              aria-label="Formation löschen"
              disabled={laeuft}
              onClick={() => {
                if (!confirm(`Formation „${formation.name}“ löschen? Die Mitglieder bleiben im Verein.`)) return;
                starte(async () => setMeldung(await formationLoeschen(formation.id)));
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-red-wash hover:text-brand-red"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
      {formation.bdkHinweis && (
        <p className="flex gap-2 rounded-lg bg-brand-amber-wash px-3 py-2 text-[12.5px] text-brand-ink">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#8a5a00]" /> {formation.bdkHinweis}
        </p>
      )}
      {formation.mitglieder.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {formation.mitglieder.map((m) => (
            <li key={m.vmId} className="inline-flex items-center gap-1 rounded-full bg-brand-bg px-3 py-1 text-[13px] text-brand-ink">
              {m.name}
              {m.auftrittsname && <span className="text-brand-ink-soft">„{m.auftrittsname}“</span>}
              {darfVerwalten && (
                <button
                  type="button"
                  aria-label={`${m.name} entfernen`}
                  disabled={laeuft}
                  onClick={() => starte(async () => setMeldung(await formationMitgliedEntfernen(formation.id, m.vmId)))}
                  className="ml-1 text-brand-ink-soft hover:text-brand-red"
                >
                  <UserMinus size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-brand-ink-soft">Noch keine Personen zugeordnet.</p>
      )}
      {meldung && <Meldung ergebnis={meldung} />}
      {darfVerwalten && <MitgliedHinzufuegen formation={formation} mitglieder={mitglieder} />}
      {darfVerwalten && bearbeiten && (
        <FormationFormular
          vereinId={vereinId}
          formation={formation}
          disziplinen={disziplinen}
          altersklassen={altersklassen}
          erlaubt={erlaubt}
          gruppen={gruppen}
          fertig={() => setBearbeiten(false)}
        />
      )}
    </li>
  );
}

export function FormationenVerwaltung(props: {
  vereinId: string;
  formationen: Formation[];
  darfVerwalten: boolean;
  mitglieder: Auswahl[];
  disziplinen: Disziplin[];
  altersklassen: Auswahl[];
  erlaubt: Record<string, string[]>;
  gruppen: Auswahl[];
}) {
  const [neu, setNeu] = useState(false);
  const { formationen, darfVerwalten, ...rest } = props;
  return (
    <div className="flex flex-col gap-3">
      {formationen.length === 0 ? (
        <p className="rounded-xl bg-brand-bg px-4 py-5 text-[13.5px] text-brand-ink-soft">Noch keine Formationen angelegt.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {formationen.map((f) => (
            <FormationKarte key={f.id} formation={f} darfVerwalten={darfVerwalten} {...rest} />
          ))}
        </ul>
      )}
      {darfVerwalten &&
        (neu ? (
          <div className="rounded-xl border border-dashed border-brand-line p-3">
            <FormationFormular {...rest} fertig={() => setNeu(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setNeu(true)} className="btn-secondary self-start">
            Neue Formation
          </button>
        ))}
    </div>
  );
}
