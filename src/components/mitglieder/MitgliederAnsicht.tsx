"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Search, X, UserCheck, UserX, Trash2, Link2 } from "lucide-react";
import {
  rolleAendern,
  aktivSetzen,
  bereicheSetzen,
  gruppeZuordnen,
  gruppeEntfernen,
  elternKindVerknuepfen,
  elternKindLoesen,
  mitgliedEntfernen,
} from "@/app/dashboard/mitglieder/actions";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import type { Mitglied, Person } from "@/lib/mitglieder/getMitglieder";

type Auswahl = { id: string; name: string };

const BEREICHE: { key: string; label: string }[] = [
  { key: "mitglieder", label: "Mitglieder" },
  { key: "anwesenheit", label: "Anwesenheit" },
  { key: "beitraege", label: "Beiträge & Finanzen" },
  { key: "material", label: "Kostüme & Material" },
  { key: "trainingsplan", label: "Trainingsplan" },
  { key: "saison", label: "Saisonplanung" },
  { key: "netzwerk", label: "Trainer-Netzwerk" },
  { key: "beitritt", label: "Mitgliedsanträge" },
];

const FUNKTION_LABEL: Record<string, string> = { trainer: "Trainer", betreuer: "Betreuer" };

const KNOPF =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[12.5px] font-medium text-brand-ink hover:bg-brand-bg disabled:opacity-50";

function initialen(name: string) {
  return name
    .replace(/^@/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Detail({
  m,
  vereinId,
  rollen,
  gruppen,
  auswahl,
  istAdmin,
  darfGruppen,
}: {
  m: Mitglied;
  vereinId: string;
  rollen: Auswahl[];
  gruppen: Auswahl[];
  auswahl: Person[];
  istAdmin: boolean;
  darfGruppen: boolean;
}) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [rolle, setRolle] = useState(m.rolleId ?? "");
  const [bereiche, setBereiche] = useState<string[]>(m.bereiche ?? []);
  const [gruppe, setGruppe] = useState("");
  const [funktion, setFunktion] = useState("");
  const [person, setPerson] = useState("");
  const [beziehung, setBeziehung] = useState<"kind" | "eltern">("kind");

  const ausfuehren = (aktion: () => Promise<AktionsErgebnis>) =>
    starte(async () => {
      setMeldung(await aktion());
    });

  const freieGruppen = gruppen.filter((g) => !m.gruppen.some((z) => z.id === g.id));
  const verknuepfbar = auswahl.filter(
    (p) => p.vmId !== m.vmId && !m.kinder.some((k) => k.vmId === p.vmId) && !m.eltern.some((e) => e.vmId === p.vmId),
  );

  return (
    <div className="flex flex-col gap-4 border-t border-brand-line bg-brand-bg/60 px-4 py-4">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
        {m.handle && (
          <div className="flex gap-2">
            <dt className="text-brand-ink-soft">Handle</dt>
            <dd className="font-medium">@{m.handle}</dd>
          </div>
        )}
        {m.email && (
          <div className="flex min-w-0 gap-2">
            <dt className="text-brand-ink-soft">E-Mail</dt>
            <dd className="truncate font-medium">
              <a href={`mailto:${m.email}`} className="text-brand-red hover:underline">
                {m.email}
              </a>
            </dd>
          </div>
        )}
        {m.altersklasse && (
          <div className="flex gap-2">
            <dt className="text-brand-ink-soft">Altersklasse</dt>
            <dd className="font-medium">{m.altersklasse}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-brand-ink-soft">Mitglied seit</dt>
          <dd className="font-medium">{new Date(m.seit).toLocaleDateString("de-DE")}</dd>
        </div>
      </dl>

      {/* Gruppen */}
      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">Gruppen</div>
        <div className="flex flex-wrap gap-2">
          {m.gruppen.length === 0 && <span className="text-[13px] text-brand-ink-soft">keiner Gruppe zugeordnet</span>}
          {m.gruppen.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white py-1 pl-3 pr-1.5 text-[12.5px]">
              {g.name}
              {g.funktion && FUNKTION_LABEL[g.funktion] && <span className="text-brand-ink-soft">· {FUNKTION_LABEL[g.funktion]}</span>}
              {darfGruppen && (
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={() => ausfuehren(() => gruppeEntfernen(m.vmId, g.id))}
                  aria-label={`Aus Gruppe ${g.name} entfernen`}
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-red-wash hover:text-brand-red"
                >
                  <X size={13} />
                </button>
              )}
            </span>
          ))}
        </div>
        {darfGruppen && freieGruppen.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={gruppe} onChange={(e) => setGruppe(e.target.value)} aria-label="Gruppe wählen" className="min-h-9 rounded-lg border border-brand-line bg-white px-2 text-[13px]">
              <option value="">Gruppe wählen …</option>
              {freieGruppen.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select value={funktion} onChange={(e) => setFunktion(e.target.value)} aria-label="Funktion in der Gruppe" className="min-h-9 rounded-lg border border-brand-line bg-white px-2 text-[13px]">
              <option value="">als Teilnehmer/in</option>
              <option value="trainer">als Trainer/in</option>
              <option value="betreuer">als Betreuer/in</option>
            </select>
            <button type="button" disabled={!gruppe || laeuft} onClick={() => ausfuehren(() => gruppeZuordnen(m.vmId, gruppe, funktion))} className={KNOPF}>
              Hinzufügen
            </button>
          </div>
        )}
      </div>

      {/* Familie */}
      {(m.eltern.length > 0 || m.kinder.length > 0 || istAdmin) && (
        <div>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">Familie</div>
          <div className="flex flex-wrap gap-2 text-[12.5px]">
            {m.eltern.length === 0 && m.kinder.length === 0 && <span className="text-[13px] text-brand-ink-soft">keine Verknüpfung</span>}
            {m.eltern.map((e) => (
              <span key={e.vmId} className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white py-1 pl-3 pr-1.5">
                Elternteil: {e.name}
                {istAdmin && (
                  <button type="button" disabled={laeuft} onClick={() => ausfuehren(() => elternKindLoesen(e.vmId, m.vmId))} aria-label="Verknüpfung lösen" className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-red-wash hover:text-brand-red">
                    <X size={13} />
                  </button>
                )}
              </span>
            ))}
            {m.kinder.map((k) => (
              <span key={k.vmId} className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white py-1 pl-3 pr-1.5">
                Kind: {k.name}
                {istAdmin && (
                  <button type="button" disabled={laeuft} onClick={() => ausfuehren(() => elternKindLoesen(m.vmId, k.vmId))} aria-label="Verknüpfung lösen" className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-red-wash hover:text-brand-red">
                    <X size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>
          {istAdmin && verknuepfbar.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={beziehung} onChange={(e) => setBeziehung(e.target.value as "kind" | "eltern")} aria-label="Beziehung" className="min-h-9 rounded-lg border border-brand-line bg-white px-2 text-[13px]">
                <option value="kind">hat als Kind</option>
                <option value="eltern">hat als Elternteil</option>
              </select>
              <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Person wählen" className="min-h-9 max-w-[220px] rounded-lg border border-brand-line bg-white px-2 text-[13px]">
                <option value="">Person wählen …</option>
                {verknuepfbar.map((p) => (
                  <option key={p.vmId} value={p.vmId}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!person || laeuft}
                onClick={() =>
                  ausfuehren(() =>
                    beziehung === "kind"
                      ? elternKindVerknuepfen(vereinId, m.vmId, person)
                      : elternKindVerknuepfen(vereinId, person, m.vmId),
                  )
                }
                className={KNOPF}
              >
                <Link2 size={13} /> Verknüpfen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Nur Vereinsadmin: Rolle, individuelle Bereiche, Status */}
      {istAdmin && (
        <>
          <div>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">Rolle im Verein</div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={rolle} onChange={(e) => setRolle(e.target.value)} aria-label="Rolle" className="min-h-9 rounded-lg border border-brand-line bg-white px-2 text-[13px]">
                {rollen.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button type="button" disabled={laeuft || rolle === (m.rolleId ?? "")} onClick={() => ausfuehren(() => rolleAendern(m.vmId, rolle))} className={KNOPF}>
                Rolle speichern
              </button>
            </div>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-soft">
              Individuelle Bereiche
            </legend>
            <p className="mb-2 text-[12.5px] text-brand-ink-soft">
              Leer lassen = Standardrechte der Rolle. Sobald etwas angehakt ist, gelten nur die angehakten Bereiche
              (Vereinsadmins haben immer alles).
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {BEREICHE.map((b) => (
                <label key={b.key} className="flex min-h-9 items-center gap-2 rounded-lg border border-brand-line bg-white px-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={bereiche.includes(b.key)}
                    onChange={(e) => setBereiche((alt) => (e.target.checked ? [...alt, b.key] : alt.filter((x) => x !== b.key)))}
                    className="h-4 w-4 accent-[var(--red)]"
                  />
                  {b.label}
                </label>
              ))}
            </div>
            <button type="button" disabled={laeuft} onClick={() => ausfuehren(() => bereicheSetzen(m.vmId, bereiche))} className={`${KNOPF} mt-2`}>
              Bereiche speichern
            </button>
          </fieldset>

          <div className="flex flex-wrap gap-2 border-t border-brand-line pt-3">
            <button type="button" disabled={laeuft} onClick={() => ausfuehren(() => aktivSetzen(m.vmId, !m.aktiv))} className={KNOPF}>
              {m.aktiv ? <UserX size={14} /> : <UserCheck size={14} />}
              {m.aktiv ? "Deaktivieren" : "Wieder aktivieren"}
            </button>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => {
                if (confirm(`${m.name} wirklich aus dem Verein entfernen? Gruppen- und Familienzuordnungen werden dabei gelöscht.`)) {
                  ausfuehren(() => mitgliedEntfernen(m.vmId));
                }
              }}
              className={`${KNOPF} border-brand-red/30 text-brand-red hover:bg-brand-red-wash`}
            >
              <Trash2 size={14} /> Aus Verein entfernen
            </button>
          </div>
        </>
      )}

      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="rounded-lg bg-brand-green-wash px-3 py-2 text-[13px] text-brand-green">{meldung.ok}</p>}
      {laeuft && <p className="text-[12.5px] text-brand-ink-soft">Wird gespeichert …</p>}
    </div>
  );
}

export function MitgliederAnsicht({
  vereinId,
  mitglieder,
  rollen,
  gruppen,
  auswahl,
  istAdmin,
  darfGruppen,
}: {
  vereinId: string;
  mitglieder: Mitglied[];
  rollen: Auswahl[];
  gruppen: Auswahl[];
  auswahl: Person[];
  istAdmin: boolean;
  darfGruppen: boolean;
}) {
  const [suche, setSuche] = useState("");
  const [gruppe, setGruppe] = useState("");
  const [rolle, setRolle] = useState("");
  const [status, setStatus] = useState<"alle" | "aktiv" | "inaktiv">("aktiv");
  const [offen, setOffen] = useState<string | null>(null);

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return mitglieder.filter(
      (m) =>
        (!s || m.name.toLowerCase().includes(s) || (m.handle ?? "").toLowerCase().includes(s) || (m.email ?? "").toLowerCase().includes(s)) &&
        (!gruppe || (gruppe === "_ohne" ? m.gruppen.length === 0 : m.gruppen.some((g) => g.id === gruppe))) &&
        (!rolle || m.rolleId === rolle) &&
        (status === "alle" || (status === "aktiv" ? m.aktiv : !m.aktiv)),
    );
  }, [mitglieder, suche, gruppe, rolle, status]);

  const aktive = mitglieder.filter((m) => m.aktiv).length;
  const ohneGruppe = mitglieder.filter((m) => m.aktiv && m.gruppen.length === 0).length;
  const FILTER = "min-h-10 rounded-xl border border-brand-line bg-white px-3 text-[13px] text-brand-ink outline-none focus:border-brand-red";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { wert: mitglieder.length, label: istAdmin ? "im Verein" : "in deinen Gruppen" },
          { wert: aktive, label: "aktiv" },
          { wert: ohneGruppe, label: "ohne Gruppe" },
        ].map((k) => (
          <div key={k.label} className="rounded-[var(--radius-l)] border border-brand-line bg-white px-4 py-3 shadow-[var(--shadow)]">
            <div className="text-[22px] font-bold leading-none text-brand-ink">{k.wert}</div>
            <div className="mt-1 text-[12.5px] text-brand-ink-soft">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-brand-line bg-white px-3 focus-within:border-brand-red sm:min-w-[240px]">
          <Search size={16} className="text-brand-ink-soft" />
          <span className="sr-only">Suchen</span>
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, @Handle oder E-Mail …" className="w-full bg-transparent text-[13.5px] outline-none" />
        </label>
        <select value={gruppe} onChange={(e) => setGruppe(e.target.value)} aria-label="Nach Gruppe filtern" className={FILTER}>
          <option value="">Alle Gruppen</option>
          <option value="_ohne">Ohne Gruppe</option>
          {gruppen.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select value={rolle} onChange={(e) => setRolle(e.target.value)} aria-label="Nach Rolle filtern" className={FILTER}>
          <option value="">Alle Rollen</option>
          {rollen.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Nach Status filtern" className={FILTER}>
          <option value="aktiv">Aktive</option>
          <option value="inaktiv">Deaktivierte</option>
          <option value="alle">Alle</option>
        </select>
      </div>

      <section className="overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)]">
        {gefiltert.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13.5px] text-brand-ink-soft">
            {mitglieder.length === 0 ? "Noch keine Mitglieder." : "Keine Mitglieder passen zu den Filtern."}
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {gefiltert.map((m) => {
              const istOffen = offen === m.vmId;
              return (
                <li key={m.vmId}>
                  <button
                    type="button"
                    onClick={() => setOffen(istOffen ? null : m.vmId)}
                    aria-expanded={istOffen}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-bg/60"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold ${m.aktiv ? "bg-brand-red-wash text-brand-red" : "bg-brand-bg text-brand-ink-faint"}`}>
                      {initialen(m.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-[14px] font-semibold ${m.aktiv ? "text-brand-ink" : "text-brand-ink-faint line-through"}`}>{m.name}</span>
                        {m.istIch && <span className="shrink-0 rounded-full bg-brand-bg px-2 py-0.5 text-[10.5px] font-semibold text-brand-ink-soft">Du</span>}
                      </span>
                      <span className="block truncate text-[12.5px] text-brand-ink-soft">
                        {m.gruppen.length > 0 ? m.gruppen.map((g) => g.name).join(", ") : "keine Gruppe"}
                      </span>
                    </span>
                    <span className="hidden shrink-0 rounded-full bg-brand-bg px-2.5 py-1 text-[12px] font-medium text-brand-ink sm:inline">{m.rolle ?? "–"}</span>
                    <ChevronDown size={18} className={`shrink-0 text-brand-ink-soft transition-transform ${istOffen ? "rotate-180" : ""}`} />
                  </button>
                  {istOffen && (
                    <Detail m={m} vereinId={vereinId} rollen={rollen} gruppen={gruppen} auswahl={auswahl} istAdmin={istAdmin} darfGruppen={darfGruppen} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
