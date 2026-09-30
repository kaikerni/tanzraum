"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, Loader2 } from "lucide-react";
import { abmelden, trainingTeilnehmer } from "@/app/dashboard/training/actions";
import { ABMELDEGRUENDE } from "@/lib/training/abmeldegruende";
import type { TrainingsTeilnehmer } from "@/lib/training/getTraining";

export type AbmeldeZiel = {
  vereinId: string;
  gruppeId: string;
  gruppeName: string;
  datum: string;
  zeit: string;
};

// selbst: eigene Abmeldung · kind: Elternteil meldet ein zugeordnetes Kind ab · trainer: Abmeldung eintragen/aendern
export type AbmeldeModus = "selbst" | "kind" | "trainer";

type Person = { vmId: string; name: string; kategorie?: string | null; hinweis?: string | null };

// Vorname fuer kurze Texte („Emma abmelden“); Profil-Handles (@…) bleiben unveraendert
export function vorname(name: string): string {
  const n = name.trim();
  if (n.startsWith("@")) return n;
  return n.split(/\s+/)[0] || n;
}

export function tagText(datum: string, heute: string): string {
  if (datum === heute) return "heute";
  const d = new Date(`${datum}T12:00:00Z`);
  const morgen = new Date(`${heute}T12:00:00Z`);
  morgen.setUTCDate(morgen.getUTCDate() + 1);
  if (d.getTime() === morgen.getTime()) return "morgen";
  return `am ${d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}`;
}

const KNOPF = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold disabled:opacity-60";

// Abmelden in wenigen Schritten: (Trainer: Person waehlen →) Grund waehlen → (Teilnehmer/Eltern: bestaetigen)
export function AbmeldeDialog({
  modus,
  ziel,
  heute,
  person,
  onSchliessen,
  onFertig,
}: {
  modus: AbmeldeModus;
  ziel: AbmeldeZiel;
  heute: string;
  person?: Person;
  onSchliessen: () => void;
  onFertig: (meldung: string) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<Person | null>(person ?? null);
  const [schritt, setSchritt] = useState<"wer" | "grund" | "bestaetigen">(modus === "trainer" && !person ? "wer" : "grund");
  const [kategorie, setKategorie] = useState<string>(person?.kategorie ?? "");
  const [hinweis, setHinweis] = useState<string>(person?.hinweis ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const [teilnehmer, setTeilnehmer] = useState<TrainingsTeilnehmer[] | null>(null);
  const [suche, setSuche] = useState("");
  const [bereit, setBereit] = useState(false);

  useEffect(() => setBereit(true), []);

  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
    }
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [onSchliessen]);

  useEffect(() => {
    if (schritt !== "wer" || teilnehmer !== null) return;
    let aktiv = true;
    trainingTeilnehmer(ziel.gruppeId, ziel.datum).then((r) => {
      if (!aktiv) return;
      if (r.error) setFehler(r.error);
      setTeilnehmer(r.liste);
    });
    return () => {
      aktiv = false;
    };
  }, [schritt, teilnehmer, ziel.gruppeId, ziel.datum]);

  const tag = tagText(ziel.datum, heute);
  const name = gewaehlt ? vorname(gewaehlt.name) : "";
  const titel =
    schritt === "wer"
      ? "Wer ist abgemeldet?"
      : schritt === "bestaetigen"
      ? modus === "kind"
        ? `${name} vom Training abmelden?`
        : "Vom Training abmelden?"
      : modus === "selbst"
      ? `Warum kannst du ${tag} nicht kommen?`
      : modus === "kind"
      ? `Warum kann ${name} ${tag} nicht kommen?`
      : `Grund für ${gewaehlt?.name ?? ""}`;

  function speichern() {
    if (!gewaehlt || !kategorie) return;
    setFehler(null);
    starte(async () => {
      const r = await abmelden(ziel.vereinId, ziel.gruppeId, ziel.datum, gewaehlt.vmId, kategorie, kategorie === "sonstiges" ? hinweis : "");
      if (r.error) setFehler(r.error);
      else onFertig(modus === "trainer" ? "Abmeldung gespeichert." : "Abgemeldet – der Trainer ist informiert.");
    });
  }

  const gefiltert = (teilnehmer ?? []).filter((t) => t.name.toLowerCase().includes(suche.trim().toLowerCase()));

  const inhalt = (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="abmelde-titel">
      <button type="button" aria-label="Schließen" className="absolute inset-0 bg-brand-navy/45" onClick={onSchliessen} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-[0_-12px_40px_-12px_rgba(27,33,48,0.35)] md:inset-auto md:left-1/2 md:top-1/2 md:w-[520px] md:max-w-[calc(100vw-32px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-brand-line md:hidden" />
        <div className="flex shrink-0 items-start gap-2 px-4 pb-2 pt-3 sm:px-5">
          {((schritt === "grund" && modus === "trainer" && !person) || schritt === "bestaetigen") && (
            <button
              type="button"
              onClick={() => setSchritt(schritt === "bestaetigen" ? "grund" : "wer")}
              aria-label="Zurück"
              className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-brand-bg"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="abmelde-titel" className="text-[18px] font-extrabold leading-snug text-brand-ink [overflow-wrap:anywhere]">
              {titel}
            </h2>
            <p className="mt-0.5 text-[13px] text-brand-ink-soft [overflow-wrap:anywhere]">
              {ziel.gruppeName} · {tag.charAt(0).toUpperCase() + tag.slice(1)}, {ziel.zeit}
            </p>
          </div>
          <button
            type="button"
            onClick={onSchliessen}
            aria-label="Schließen"
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-brand-bg"
          >
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:px-5">
          {schritt === "wer" && (
            <div className="flex flex-col gap-2 pb-2">
              {teilnehmer === null ? (
                <p className="flex items-center gap-2 py-6 text-[14px] text-brand-ink-soft">
                  <Loader2 size={18} className="animate-spin" /> Teilnehmer werden geladen …
                </p>
              ) : teilnehmer.length === 0 ? (
                <p className="py-4 text-[14px] text-brand-ink-soft">Dieser Gruppe sind noch keine Teilnehmer zugeordnet.</p>
              ) : (
                <>
                  {teilnehmer.length > 8 && (
                    <input
                      value={suche}
                      onChange={(e) => setSuche(e.target.value)}
                      placeholder="Name suchen"
                      aria-label="Name suchen"
                      className="mb-1 min-h-11 rounded-xl border border-brand-line px-3 text-[15px] outline-none focus:border-brand-red"
                    />
                  )}
                  <ul className="flex flex-col gap-2">
                    {gefiltert.map((t) => (
                      <li key={t.vmId}>
                        <button
                          type="button"
                          onClick={() => {
                            setGewaehlt({ vmId: t.vmId, name: t.name, kategorie: t.kategorie, hinweis: t.hinweis });
                            setKategorie(t.kategorie ?? "");
                            setHinweis(t.hinweis ?? "");
                            setSchritt("grund");
                          }}
                          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-brand-line px-4 py-2.5 text-left hover:bg-brand-bg"
                        >
                          <span aria-hidden>{t.abgemeldet ? "🔴" : "🟢"}</span>
                          <span className="min-w-0 flex-1 text-[15px] font-semibold text-brand-ink [overflow-wrap:anywhere]">{t.name}</span>
                          {t.abgemeldet && <span className="shrink-0 text-[12px] font-semibold text-brand-red">abgemeldet – ändern</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {schritt === "grund" && (
            <div className="flex flex-col gap-3 pb-1">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Grund">
                {ABMELDEGRUENDE.map((g) => {
                  const aktiv = kategorie === g.wert;
                  return (
                    <button
                      key={g.wert}
                      type="button"
                      role="radio"
                      aria-checked={aktiv}
                      onClick={() => {
                        setKategorie(g.wert);
                        setFehler(null);
                      }}
                      className={`flex min-h-14 items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-left text-[14.5px] font-semibold leading-tight ${
                        g.wert === "sonstiges" ? "col-span-2" : ""
                      } ${aktiv ? "border-brand-red bg-brand-red-wash text-brand-red-deep" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"}`}
                    >
                      <span className="text-[22px]" aria-hidden>
                        {g.emoji}
                      </span>
                      <span className="min-w-0">{g.label}</span>
                    </button>
                  );
                })}
              </div>
              {kategorie === "sonstiges" && (
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-brand-ink">Kurz beschreiben (optional)</span>
                  <input
                    value={hinweis}
                    onChange={(e) => setHinweis(e.target.value)}
                    maxLength={200}
                    autoFocus
                    className="min-h-12 rounded-xl border border-brand-line px-3 text-[15px] outline-none focus:border-brand-red"
                  />
                </label>
              )}
              {fehler && <p className="form-error">{fehler}</p>}
              <button
                type="button"
                disabled={!kategorie || laeuft}
                onClick={() => (modus === "trainer" ? speichern() : setSchritt("bestaetigen"))}
                className={`${KNOPF} mt-1 w-full bg-brand-red text-white hover:bg-brand-red-deep`}
              >
                {laeuft && <Loader2 size={18} className="animate-spin" />}
                {modus === "trainer" ? "Abmeldung speichern" : "Weiter"}
              </button>
            </div>
          )}

          {schritt === "bestaetigen" && (
            <div className="flex flex-col gap-4 pb-1">
              <p className="rounded-2xl bg-brand-bg px-4 py-3 text-[14.5px] text-brand-ink">
                {modus === "kind" ? "Die" : "Deine"} Abmeldung wird an den zuständigen Trainer übermittelt.
                <span className="mt-1.5 block font-semibold">
                  Grund: {ABMELDEGRUENDE.find((g) => g.wert === kategorie)?.emoji} {ABMELDEGRUENDE.find((g) => g.wert === kategorie)?.label}
                  {kategorie === "sonstiges" && hinweis.trim() ? ` – ${hinweis.trim()}` : ""}
                </span>
              </p>
              {fehler && <p className="form-error">{fehler}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSchritt("grund")} className={`${KNOPF} border border-brand-line bg-white text-brand-ink hover:bg-brand-bg`}>
                  Zurück
                </button>
                <button type="button" disabled={laeuft} onClick={speichern} className={`${KNOPF} bg-brand-red text-white hover:bg-brand-red-deep`}>
                  {laeuft && <Loader2 size={18} className="animate-spin" />}
                  Jetzt abmelden
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return bereit ? createPortal(inhalt, document.body) : null;
}
