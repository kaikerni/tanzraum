"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Shield, Trash2, UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { NutzerAvatar } from "@/components/ui/NutzerAvatar";
import { PersonenSuche } from "@/components/admin/PersonenSuche";
import { teamEntfernen, teamSpeichern, type PersonTreffer } from "@/app/dashboard/admin/team/actions";
import { RECHTE_GRUPPEN, rechtLabel } from "@/lib/team/rechte";

export type TeamMitglied = {
  userId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  moderator: boolean;
  kennzeichnen: boolean;
  alleRechte: boolean;
  rechte: string[];
  notiz: string | null;
  seit: string;
  teamBasic: boolean;
  teamBasicBis: string | null;
  tarif: string;
  verein: string | null;
};

type Entwurf = {
  userId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  neu: boolean;
  moderator: boolean;
  kennzeichnen: boolean;
  alleRechte: boolean;
  rechte: Set<string>;
  basic: boolean;
  basicBefristet: boolean;
  basicBis: string;
  notiz: string;
};

const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "");
const isoTag = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : "");

function Schalter({ an, onAendern, titel, text }: { an: boolean; onAendern: (an: boolean) => void; titel: string; text?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-line p-3 hover:bg-brand-bg">
      <input type="checkbox" checked={an} onChange={(e) => onAendern(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#e11d2e]" />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-brand-ink">{titel}</span>
        {text && <span className="block text-[12.5px] text-brand-ink-soft">{text}</span>}
      </span>
    </label>
  );
}

export function TeamVerwaltung({ mitglieder, start }: { mitglieder: TeamMitglied[]; start?: PersonTreffer | null }) {
  const router = useRouter();
  const [suche, setSuche] = useState(false);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(() => (start ? neuerEntwurf(start, mitglieder) : null));
  const [entfernen, setEntfernen] = useState<TeamMitglied | null>(null);
  const [basicBehalten, setBasicBehalten] = useState(false);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();

  function neuerEntwurf(p: { userId: string; name: string; handle: string | null; avatarUrl: string | null }, liste: TeamMitglied[]): Entwurf {
    const m = liste.find((x) => x.userId === p.userId);
    return {
      userId: p.userId,
      name: p.name,
      handle: p.handle,
      avatarUrl: p.avatarUrl,
      neu: !m,
      moderator: m?.moderator ?? false,
      kennzeichnen: m?.kennzeichnen ?? true,
      alleRechte: m?.alleRechte ?? false,
      rechte: new Set(m?.rechte ?? []),
      basic: m?.teamBasic ?? false,
      basicBefristet: !!m?.teamBasicBis,
      basicBis: isoTag(m?.teamBasicBis ?? null),
      notiz: m?.notiz ?? "",
    };
  }

  function recht(r: string, an: boolean) {
    setEntwurf((e) => {
      if (!e) return e;
      const neu = new Set(e.rechte);
      if (an) neu.add(r);
      else {
        neu.delete(r);
        // Bereich weg -> seine Aktionen weg
        if (!r.includes(".")) for (const x of [...neu]) if (x.startsWith(`${r}.`)) neu.delete(x);
      }
      return { ...e, rechte: neu };
    });
  }

  function speichern() {
    if (!entwurf) return;
    if (entwurf.basic && entwurf.basicBefristet && !entwurf.basicBis) return setMeldung({ error: "Bitte ein Enddatum für das kostenlose BASIC wählen." });
    starte(async () => {
      const r = await teamSpeichern({
        userId: entwurf.userId,
        moderator: entwurf.moderator,
        kennzeichnen: entwurf.kennzeichnen,
        alleRechte: entwurf.alleRechte,
        rechte: [...entwurf.rechte],
        basic: entwurf.basic,
        basicBis: entwurf.basic && entwurf.basicBefristet ? entwurf.basicBis : null,
        notiz: entwurf.notiz,
      });
      setMeldung(r.error ? r : { error: null, ok: entwurf.neu ? `${entwurf.name} ist jetzt im TanzRaum Team.` : "Rechte gespeichert." });
      if (!r.error) {
        setEntwurf(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSuche(true)} className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5">
          <Plus size={17} /> Teammitglied hinzufügen
        </button>
        {meldung && !entwurf && <Meldung ergebnis={meldung} />}
      </div>

      {mitglieder.length === 0 ? (
        <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px] text-brand-ink-soft">Noch keine Teammitglieder.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {mitglieder.map((m) => (
            <li key={m.userId} className="flex flex-col gap-2 rounded-2xl border border-brand-line bg-white p-3">
              <div className="flex items-center gap-3">
                <NutzerAvatar name={m.name} avatarUrl={m.avatarUrl} groesse={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-brand-ink">{m.name}</p>
                  <p className="truncate text-[12.5px] text-brand-ink-soft">
                    {m.handle ? `@${m.handle}` : ""}
                    {m.verein ? ` · ${m.verein}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Rechte von ${m.name} verwalten`}
                  onClick={() => setEntwurf(neuerEntwurf(m, mitglieder))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-line hover:bg-brand-bg"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  aria-label={`${m.name} aus dem Team entfernen`}
                  onClick={() => {
                    setBasicBehalten(false);
                    setEntfernen(m);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-line text-brand-red hover:bg-brand-red-wash"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
                <span className="rounded-full bg-brand-blue-wash px-2 py-0.5 text-brand-blue">🛡 TanzRaum Team{m.moderator ? " · Moderator" : ""}</span>
                {!m.kennzeichnen && <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">nicht öffentlich gekennzeichnet</span>}
                {m.teamBasic && (
                  <span className="rounded-full bg-brand-green-wash px-2 py-0.5 text-brand-green">BASIC kostenlos{m.teamBasicBis ? ` bis ${datum(m.teamBasicBis)}` : " · unbefristet"}</span>
                )}
                <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">Tarif {m.tarif.toUpperCase()}</span>
              </div>
              <p className="text-[12.5px] text-brand-ink-soft">
                {m.alleRechte
                  ? "Alle verfügbaren Team-Bereiche (kein TanzRaum-Admin)"
                  : m.rechte.length === 0
                    ? "Noch keine Rechte vergeben"
                    : RECHTE_GRUPPEN.filter((g) => m.rechte.includes(g.bereich))
                        .map((g) => `${g.emoji} ${g.label}: ${g.aktionen.filter((a) => m.rechte.includes(a.recht)).map((a) => a.label).join(", ") || "nur ansehen"}`)
                        .join(" · ")}
              </p>
              {m.notiz && <p className="text-[12px] italic text-brand-ink-faint">Notiz: {m.notiz}</p>}
            </li>
          ))}
        </ul>
      )}

      {suche && (
        <Dialog titel="Teammitglied hinzufügen" untertitel="Wähle einen bestehenden TanzRaum-Nutzer." onSchliessen={() => setSuche(false)}>
          <PersonenSuche
            hinweis="Teammitglieder erhalten nur die Rechte, die du ausdrücklich vergibst – nie Admin-Rechte."
            onWahl={(p) => {
              setSuche(false);
              setMeldung(null);
              setEntwurf(neuerEntwurf(p, mitglieder));
            }}
          />
        </Dialog>
      )}

      {entwurf && (
        <Dialog
          breit
          titel={entwurf.neu ? "Zum TanzRaum Team hinzufügen" : "Rechte verwalten"}
          untertitel={`${entwurf.name}${entwurf.handle ? ` · @${entwurf.handle}` : ""}`}
          onSchliessen={() => setEntwurf(null)}
          fuss={
            <div className="flex flex-col gap-2">
              {meldung?.error && <Meldung ergebnis={meldung} />}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEntwurf(null)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                  Abbrechen
                </button>
                <button type="button" disabled={laeuft} onClick={speichern} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60">
                  <UserPlus size={16} /> {entwurf.neu ? "Hinzufügen" : "Speichern"}
                </button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Schalter an={entwurf.moderator} onAendern={(an) => setEntwurf({ ...entwurf, moderator: an })} titel="Moderator" text="Kennzeichnung „🛡 TanzRaum Team · Moderator“" />
              <Schalter
                an={entwurf.kennzeichnen}
                onAendern={(an) => setEntwurf({ ...entwurf, kennzeichnen: an })}
                titel="Öffentlich kennzeichnen"
                text="Zeigt „🛡 TanzRaum Team“ im Treff"
              />
            </div>
            <Schalter
              an={entwurf.alleRechte}
              onAendern={(an) => setEntwurf({ ...entwurf, alleRechte: an })}
              titel="Alle verfügbaren Team-Bereiche verwalten"
              text="Alle vorgesehenen Teamrechte – macht die Person NICHT zum TanzRaum-Admin (kein Team verwalten, keine Freischaltungen, keine Admin-Rechte)."
            />
            {!entwurf.alleRechte && (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-bold uppercase tracking-wide text-brand-ink-faint">Bereiche & Aktionen</p>
                {RECHTE_GRUPPEN.map((g) => {
                  const an = entwurf.rechte.has(g.bereich);
                  return (
                    <fieldset key={g.bereich} className={`rounded-2xl border p-3 ${an ? "border-brand-red/40 bg-brand-red-wash/30" : "border-brand-line"}`}>
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input type="checkbox" checked={an} onChange={(e) => recht(g.bereich, e.target.checked)} className="h-5 w-5 accent-[#e11d2e]" />
                        <span className="text-[14.5px] font-bold text-brand-ink">
                          {g.emoji} {g.label}
                        </span>
                        <span className="hidden text-[12px] text-brand-ink-soft sm:inline">– {g.text}</span>
                      </label>
                      {an && (
                        <div className="mt-2 grid gap-1 pl-1 sm:grid-cols-2">
                          {g.aktionen.map((a) => (
                            <label key={a.recht} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-[13.5px] hover:bg-white">
                              <input type="checkbox" checked={entwurf.rechte.has(a.recht)} onChange={(e) => recht(a.recht, e.target.checked)} className="h-4 w-4 accent-[#e11d2e]" />
                              {a.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  );
                })}
              </div>
            )}
            <div className="rounded-2xl border border-brand-line p-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={entwurf.basic} onChange={(e) => setEntwurf({ ...entwurf, basic: e.target.checked })} className="h-5 w-5 accent-[#e11d2e]" />
                <span className="text-[14.5px] font-bold text-brand-ink">BASIC kostenlos freischalten</span>
              </label>
              <p className="mt-1 text-[12.5px] text-brand-ink-soft">Unabhängig von der Teamrolle (intern TEAM_FREE). Bei Ablauf gilt die normale Tariflogik, das Konto bleibt bestehen.</p>
              {entwurf.basic && (
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[13.5px]">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={!entwurf.basicBefristet} onChange={() => setEntwurf({ ...entwurf, basicBefristet: false })} className="accent-[#e11d2e]" /> Unbefristet
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={entwurf.basicBefristet} onChange={() => setEntwurf({ ...entwurf, basicBefristet: true })} className="accent-[#e11d2e]" /> Befristet bis
                  </label>
                  {entwurf.basicBefristet && (
                    <input
                      type="date"
                      value={entwurf.basicBis}
                      min={new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })}
                      onChange={(e) => setEntwurf({ ...entwurf, basicBis: e.target.value })}
                      className="rounded-lg border border-brand-line px-2 py-1.5"
                      aria-label="BASIC befristet bis"
                    />
                  )}
                </div>
              )}
            </div>
            <label className="field">
              Interne Notiz (nur für den TanzRaum-Admin)
              <textarea
                value={entwurf.notiz}
                maxLength={500}
                rows={2}
                onChange={(e) => setEntwurf({ ...entwurf, notiz: e.target.value })}
                className="rounded-xl border border-brand-line p-2.5 text-[13.5px] font-normal text-brand-ink outline-none focus:border-brand-red"
              />
            </label>
            <p className="flex items-start gap-1.5 text-[12px] text-brand-ink-soft">
              <Shield size={14} className="mt-0.5 shrink-0" /> Teammitglieder können niemals sich selbst oder andere zum Admin machen, keine Teammitglieder hinzufügen und
              keine Rechte verändern. Jede Änderung wird protokolliert.
            </p>
          </div>
        </Dialog>
      )}

      {entfernen && (
        <Dialog
          titel="Aus dem Team entfernen?"
          untertitel={entfernen.name}
          onSchliessen={() => setEntfernen(null)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEntfernen(null)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() =>
                  starte(async () => {
                    const r = await teamEntfernen(entfernen.userId, basicBehalten);
                    setMeldung(r);
                    setEntfernen(null);
                    router.refresh();
                  })
                }
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60"
              >
                Entfernen
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-brand-ink">
            Alle Teamrechte ({entfernen.alleRechte ? "alle Bereiche" : entfernen.rechte.map(rechtLabel).join(", ") || "keine"}) werden entzogen. Das Konto bleibt bestehen.
          </p>
          {entfernen.teamBasic && (
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-brand-line p-3 text-[14px]">
              <input type="checkbox" checked={basicBehalten} onChange={(e) => setBasicBehalten(e.target.checked)} className="h-5 w-5 accent-[#e11d2e]" />
              Kostenloses BASIC behalten
            </label>
          )}
        </Dialog>
      )}
    </div>
  );
}
