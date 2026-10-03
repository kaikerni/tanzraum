"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, Loader2, Search, Check, Users, User, Heart } from "lucide-react";
import { gruppenPersonen, gruppenBesetzung, gruppeAssistentSpeichern, type AssistentPerson } from "@/app/dashboard/verein/actions";
import type { Auswahl, DisziplinInfo, GruppeUebersicht } from "@/lib/verein/getVerein";

type Art = "gruppe" | "paar" | "solo";
export type AssistentSchritt = "art" | "name" | "altersklasse" | "disziplin" | "taenzer" | "trainer" | "betreuer" | "uebersicht";

const SCHRITT_LABEL: Record<AssistentSchritt, string> = {
  art: "Art",
  name: "Gruppe",
  altersklasse: "Altersklasse",
  disziplin: "Disziplin",
  taenzer: "Tänzer",
  trainer: "Trainer",
  betreuer: "Betreuer",
  uebersicht: "Fertig",
};

const GROSS = "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-bold disabled:opacity-50";
const OPTION = "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left text-[15px] font-semibold";

function zeichen(g: AssistentPerson["geschlecht"]) {
  return g === "weiblich" ? "♀" : g === "männlich" ? "♂" : "";
}

// Gefuehrter Assistent: Art → Name → Altersklasse → Disziplin → Tänzer → Trainer → Betreuer → Übersicht.
// Altersklasse, Gruppe und Disziplin bleiben getrennt; die Gruppenstaerke ergibt sich aus den zugeordneten Tänzern.
export function GruppenAssistent({
  vereinId,
  altersklassen,
  disziplinen,
  freieAltersklassen,
  gruppe,
  start,
  onSchliessen,
}: {
  vereinId: string;
  altersklassen: Auswahl[];
  disziplinen: DisziplinInfo[];
  freieAltersklassen: string[];
  gruppe?: GruppeUebersicht;
  start?: AssistentSchritt;
  onSchliessen: () => void;
}) {
  const router = useRouter();
  const bearbeiten = !!gruppe;
  const anfangsDisziplin = disziplinen.find((d) => d.id === gruppe?.disziplinId);
  const [art, setArt] = useState<Art>(anfangsDisziplin?.besetzung === "paar" ? "paar" : anfangsDisziplin?.besetzung === "solo" ? "solo" : "gruppe");
  const [name, setName] = useState(gruppe?.name ?? "");
  const [akTyp, setAkTyp] = useState<"offiziell" | "frei" | "keine">(gruppe?.altersklasseFrei ? "frei" : gruppe?.altersklasseId ? "offiziell" : bearbeiten ? "keine" : "offiziell");
  const [akId, setAkId] = useState<string | null>(gruppe?.altersklasseId ?? null);
  const [akFrei, setAkFrei] = useState(gruppe?.altersklasseFrei ?? "");
  const [disziplinId, setDisziplinId] = useState<string | null>(gruppe?.disziplinId ?? null);
  const [taenzer, setTaenzer] = useState<string[]>([]);
  const [trainer, setTrainer] = useState<string[]>([]);
  const [betreuer, setBetreuer] = useState<string[]>([]);
  const [personen, setPersonen] = useState<AssistentPerson[] | null>(null);
  const [suche, setSuche] = useState("");
  const [schritt, setSchritt] = useState<AssistentSchritt>(start ?? (bearbeiten ? "uebersicht" : "art"));
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const [bereit, setBereit] = useState(false);

  useEffect(() => setBereit(true), []);
  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
    }
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [onSchliessen]);

  // Mitglieder (und bei „Bearbeiten“ die bisherige Besetzung) laden
  useEffect(() => {
    let aktiv = true;
    (async () => {
      const [p, b] = await Promise.all([gruppenPersonen(vereinId), gruppe ? gruppenBesetzung(gruppe.id) : Promise.resolve(null)]);
      if (!aktiv) return;
      if (p.error) setFehler(p.error);
      setPersonen(p.liste);
      if (b) {
        setTaenzer(b.taenzer);
        setTrainer(b.trainer);
        setBetreuer(b.betreuer);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [vereinId, gruppe]);

  // Disziplinen passend zu Art und Altersklasse (offizielle Altersklasse: nur dort vorgesehene Disziplinen)
  const moegliche = useMemo(() => {
    const zurArt = disziplinen.filter((d) => d.besetzung === (art === "paar" ? "paar" : art === "solo" ? "solo" : "gruppe"));
    return akTyp === "offiziell" && akId ? zurArt.filter((d) => d.altersklassen.includes(akId)) : zurArt;
  }, [disziplinen, art, akTyp, akId]);
  const disziplin = disziplinen.find((d) => d.id === disziplinId) ?? null;

  // Ungueltige Disziplin nach Wechsel von Art/Altersklasse verwerfen; Tanzpaar hat genau eine Disziplin
  useEffect(() => {
    if (disziplinId && !moegliche.some((d) => d.id === disziplinId)) setDisziplinId(null);
    if (art === "paar" && moegliche.length === 1 && disziplinId !== moegliche[0].id) setDisziplinId(moegliche[0].id);
  }, [moegliche, disziplinId, art]);

  const schritte: AssistentSchritt[] = bearbeiten
    ? ["name", "altersklasse", "disziplin", "taenzer", "trainer", "betreuer", "uebersicht"]
    : ["art", "name", "altersklasse", "disziplin", "taenzer", "trainer", "betreuer", "uebersicht"];
  const index = schritte.indexOf(schritt);
  const naechster = () => {
    setFehler(null);
    setSuche("");
    setSchritt(schritte[Math.min(index + 1, schritte.length - 1)]);
  };
  const zurueck = () => {
    setFehler(null);
    setSuche("");
    setSchritt(schritte[Math.max(index - 1, 0)]);
  };

  const person = (id: string) => personen?.find((p) => p.vmId === id);
  const name0 = (id: string) => person(id)?.name ?? "Mitglied";
  const weiblich = taenzer.filter((id) => person(id)?.geschlecht === "weiblich");
  const maennlich = taenzer.filter((id) => person(id)?.geschlecht === "männlich");
  const soloGeschlecht = disziplin?.besetzung === "solo" ? (/weiblich/i.test(disziplin.name) ? "weiblich" : /männlich/i.test(disziplin.name) ? "männlich" : null) : null;
  const teilnehmerWort = art === "gruppe" ? "Tänzer" : "Teilnehmer";
  const akText = akTyp === "offiziell" ? (altersklassen.find((a) => a.id === akId)?.name ?? "–") : akTyp === "frei" ? akFrei.trim() || "–" : "keine";

  // Pruefungen je Schritt (die Datenbank prueft beim Speichern erneut)
  function pruefen(s: AssistentSchritt): string | null {
    if (s === "name") {
      const n = name.trim();
      if (!n) return "Bitte einen Namen eingeben.";
      if (altersklassen.some((a) => a.name.toLowerCase() === n.toLowerCase())) return `„${n}“ ist eine Altersklasse – bitte der Gruppe einen eigenen Namen geben (z. B. „Juniorengarde“ oder „Garde Blau“).`;
    }
    if (s === "altersklasse") {
      if (akTyp === "offiziell" && !akId) return "Bitte eine Altersklasse wählen.";
      if (akTyp === "frei" && !akFrei.trim()) return "Bitte die eigene Altersklasse eingeben, z. B. „Bambinis“.";
      if (akTyp === "frei" && akFrei.trim().toLowerCase() === name.trim().toLowerCase()) return "Altersklasse und Gruppenname müssen sich unterscheiden.";
    }
    if (s === "disziplin" && art !== "gruppe" && !disziplinId) return "Bitte eine Disziplin wählen.";
    if (s === "taenzer") {
      if (art === "paar" && (weiblich.length > 1 || maennlich.length > 1 || taenzer.length > 2)) return "Ein Tanzpaar besteht aus einer weiblichen und einer männlichen Person.";
      if (art === "solo" && taenzer.length > 1) return "Bei Solisten tanzt genau eine Person.";
    }
    return null;
  }

  function weiter() {
    const f = pruefen(schritt);
    if (f) return setFehler(f);
    naechster();
  }

  function speichern() {
    for (const s of ["name", "altersklasse", "disziplin", "taenzer"] as AssistentSchritt[]) {
      const f = pruefen(s);
      if (f) {
        setSchritt(s);
        return setFehler(f);
      }
    }
    setFehler(null);
    starte(async () => {
      const r = await gruppeAssistentSpeichern({
        vereinId,
        gruppeId: gruppe?.id ?? null,
        name: name.trim(),
        altersklasseId: akTyp === "offiziell" ? akId : null,
        altersklasseFrei: akTyp === "frei" ? akFrei.trim() : null,
        disziplinId,
        taenzer,
        trainer,
        betreuer,
        personen: true,
      });
      if (r.error) return setFehler(r.error);
      router.refresh();
      setFertig(r.gruppeId ?? gruppe?.id ?? null);
    });
  }

  // Funktionale Updates: auch schnell hintereinander getippte Personen werden alle übernommen
  function umschalten(setze: React.Dispatch<React.SetStateAction<string[]>>, id: string) {
    setze((liste) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]));
  }

  // Personenliste mit Suche und Mehrfachauswahl; Personen mit anderer Aufgabe in dieser Gruppe sind gesperrt
  function PersonenListe({
    kandidaten,
    gewaehlt,
    setze,
    andere,
    alleKnopf = false,
  }: {
    kandidaten: AssistentPerson[];
    gewaehlt: string[];
    setze: React.Dispatch<React.SetStateAction<string[]>>;
    andere: Record<string, string>;
    alleKnopf?: boolean;
  }) {
    const gefiltert = kandidaten.filter((p) => p.name.toLowerCase().includes(suche.trim().toLowerCase()));
    const waehlbar = gefiltert.filter((p) => !andere[p.vmId]).map((p) => p.vmId);
    return (
      <div className="flex flex-col gap-2">
        <label className="relative">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-soft" />
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Mitglied suchen"
            aria-label="Mitglied suchen"
            className="min-h-12 w-full rounded-xl border border-brand-line pl-10 pr-3 text-[15px] outline-none focus:border-brand-red"
          />
        </label>
        {alleKnopf && waehlbar.length > 0 && (
          <button
            type="button"
            onClick={() => setze((alt) => (waehlbar.every((id) => alt.includes(id)) ? alt.filter((id) => !waehlbar.includes(id)) : [...new Set([...alt, ...waehlbar])]))}
            className="self-start text-[13.5px] font-semibold text-brand-red"
          >
            {waehlbar.every((id) => gewaehlt.includes(id)) ? "Auswahl aufheben" : "Alle auswählen"}
          </button>
        )}
        {kandidaten.length === 0 ? (
          <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13.5px] text-brand-ink-soft">Keine passenden Mitglieder im Verein.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {gefiltert.map((p) => {
              const an = gewaehlt.includes(p.vmId);
              const gesperrt = andere[p.vmId];
              return (
                <li key={p.vmId}>
                  <button
                    type="button"
                    disabled={!!gesperrt}
                    onClick={() => umschalten(setze, p.vmId)}
                    aria-pressed={an}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3.5 py-2 text-left disabled:opacity-50 ${an ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white hover:bg-brand-bg"}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${an ? "border-brand-red bg-brand-red text-white" : "border-brand-line"}`}>
                      {an && <Check size={15} />}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-semibold text-brand-ink [overflow-wrap:anywhere]">{p.name}</span>
                    {gesperrt ? <span className="shrink-0 text-[12px] text-brand-ink-soft">{gesperrt}</span> : <span className="shrink-0 text-[14px] text-brand-ink-soft">{zeichen(p.geschlecht)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // Einzelauswahl (Tanzpaar weiblich/maennlich, Solist)
  function EinePerson({ titel, kandidaten, wert, setze }: { titel: string; kandidaten: AssistentPerson[]; wert: string | null; setze: (id: string | null) => void }) {
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-bold text-brand-ink">{titel}</span>
        <select
          value={wert ?? ""}
          onChange={(e) => setze(e.target.value || null)}
          className="min-h-12 rounded-xl border border-brand-line bg-white px-3 text-[15px] outline-none focus:border-brand-red"
        >
          <option value="">Mitglied auswählen</option>
          {kandidaten.map((p) => (
            <option key={p.vmId} value={p.vmId} disabled={trainer.includes(p.vmId) || betreuer.includes(p.vmId)}>
              {p.name}
            </option>
          ))}
        </select>
        {kandidaten.length === 0 && <span className="text-[12.5px] text-brand-ink-soft">Im Verein gibt es dafür noch kein passendes Mitglied (Geschlecht im Profil).</span>}
      </label>
    );
  }

  const aufgaben = (ohne: "taenzer" | "trainer" | "betreuer") => {
    const m: Record<string, string> = {};
    if (ohne !== "taenzer") for (const id of taenzer) m[id] = "tanzt";
    if (ohne !== "trainer") for (const id of trainer) m[id] = "ist Trainer";
    if (ohne !== "betreuer") for (const id of betreuer) m[id] = "ist Betreuer";
    return m;
  };

  const p = personen ?? [];
  const inhalt = (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="assistent-titel">
      <button type="button" aria-label="Schließen" className="absolute inset-0 bg-brand-navy/45" onClick={onSchliessen} />
      <div className="absolute inset-x-0 bottom-0 top-[4dvh] flex flex-col rounded-t-3xl bg-white shadow-[0_-12px_40px_-12px_rgba(27,33,48,0.35)] md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(760px,92dvh)] md:w-[600px] md:max-w-[calc(100vw-32px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
        {/* Kopf + Schrittanzeige */}
        <div className="shrink-0 border-b border-brand-line px-4 pb-3 pt-3 sm:px-5">
          <div className="flex items-center gap-2">
            {!fertig && index > 0 && (
              <button type="button" onClick={zurueck} aria-label="Zurück" className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg">
                <ChevronLeft size={22} />
              </button>
            )}
            <h2 id="assistent-titel" className="min-w-0 flex-1 text-[18px] font-extrabold text-brand-ink [overflow-wrap:anywhere]">
              {bearbeiten ? `${gruppe?.name ?? "Gruppe"} bearbeiten` : "Gruppe anlegen"}
            </h2>
            <button type="button" onClick={onSchliessen} aria-label="Schließen" className="-mr-1 flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg">
              <X size={22} />
            </button>
          </div>
          {!fertig && (
            <ol className="mt-2 flex gap-1" aria-label="Schritte">
              {schritte.map((s, i) => (
                <li key={s} className="min-w-0 flex-1" aria-current={s === schritt ? "step" : undefined}>
                  <span className={`block h-1.5 rounded-full ${i <= index ? "bg-brand-red" : "bg-brand-line"}`} />
                  <span className={`mt-1 hidden truncate text-[11px] sm:block ${s === schritt ? "font-bold text-brand-ink" : "text-brand-ink-soft"}`}>{SCHRITT_LABEL[s]}</span>
                </li>
              ))}
            </ol>
          )}
          {!fertig && <p className="mt-1 text-[12px] text-brand-ink-soft sm:hidden">Schritt {index + 1} von {schritte.length}: {SCHRITT_LABEL[schritt]}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {fertig !== null ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green-wash text-brand-green">
                <Check size={28} />
              </span>
              <p className="text-[18px] font-extrabold text-brand-ink [overflow-wrap:anywhere]">
                {bearbeiten ? "Gespeichert" : `„${name.trim()}“ ist angelegt`}
              </p>
              <p className="text-[14px] text-brand-ink-soft">Trainingszeiten, Abmeldungen und Anwesenheit hängen jetzt direkt an dieser Gruppe.</p>
              <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {fertig && (
                  <Link href={`/dashboard/verein/gruppen/${fertig}`} className={`${GROSS} bg-brand-ink text-white`}>
                    Gruppe öffnen
                  </Link>
                )}
                {fertig && (
                  <Link href={`/dashboard/training/neu?gruppe=${fertig}`} className={`${GROSS} border border-brand-line text-brand-ink`}>
                    Training anlegen
                  </Link>
                )}
                <button type="button" onClick={onSchliessen} className={`${GROSS} text-brand-ink-soft`}>
                  Fertig
                </button>
              </div>
            </div>
          ) : schritt === "art" ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[17px] font-bold text-brand-ink">Was möchtest du anlegen?</p>
              {(
                [
                  ["gruppe", Users, "Gruppe", "z. B. Juniorengarde, Schautanzgruppe"],
                  ["paar", Heart, "Tanzpaar", "eine weibliche und eine männliche Person"],
                  ["solo", User, "Solist", "eine einzelne Person"],
                ] as const
              ).map(([wert, Icon, titel, text]) => (
                <button
                  key={wert}
                  type="button"
                  onClick={() => {
                    setArt(wert);
                    setTaenzer([]);
                    setDisziplinId(null);
                  }}
                  aria-pressed={art === wert}
                  className={`${OPTION} ${art === wert ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white hover:bg-brand-bg"}`}
                >
                  <Icon size={22} className={art === wert ? "text-brand-red" : "text-brand-ink-soft"} />
                  <span className="min-w-0">
                    <span className="block text-brand-ink">{titel}</span>
                    <span className="block text-[13px] font-medium text-brand-ink-soft">{text}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : schritt === "name" ? (
            <label className="flex flex-col gap-2">
              <span className="text-[17px] font-bold text-brand-ink">{art === "paar" ? "Name des Tanzpaars" : art === "solo" ? "Name des Eintrags" : "Name der Gruppe"}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
                placeholder={art === "paar" ? "z. B. Tanzpaar Müller" : art === "solo" ? "z. B. Solistin Lena" : "z. B. Juniorengarde"}
                className="min-h-12 rounded-xl border border-brand-line px-3 text-[16px] outline-none focus:border-brand-red"
              />
              <span className="text-[13px] text-brand-ink-soft">Der Name der Gruppe – nicht die Altersklasse (die kommt im nächsten Schritt).</span>
            </label>
          ) : schritt === "altersklasse" ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[17px] font-bold text-brand-ink">Welche Altersklasse?</p>
              <p className="text-[12.5px] font-semibold uppercase tracking-wide text-brand-ink-soft">Turnier-Altersklassen</p>
              {altersklassen.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAkTyp("offiziell");
                    setAkId(a.id);
                  }}
                  aria-pressed={akTyp === "offiziell" && akId === a.id}
                  className={`${OPTION} ${akTyp === "offiziell" && akId === a.id ? "border-brand-red bg-brand-red-wash text-brand-ink" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"}`}
                >
                  {a.name}
                </button>
              ))}
              <p className="mt-2 text-[12.5px] font-semibold uppercase tracking-wide text-brand-ink-soft">Eigene Altersklasse (ohne Turnierstruktur)</p>
              <button
                type="button"
                onClick={() => setAkTyp("frei")}
                aria-pressed={akTyp === "frei"}
                className={`${OPTION} ${akTyp === "frei" ? "border-brand-red bg-brand-red-wash text-brand-ink" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"}`}
              >
                Eigene Altersklasse
              </button>
              {akTyp === "frei" && (
                <div className="flex flex-col gap-2 pl-1">
                  <input
                    value={akFrei}
                    onChange={(e) => setAkFrei(e.target.value)}
                    maxLength={40}
                    autoFocus
                    placeholder="z. B. Bambinis, Minis, Erwachsene"
                    aria-label="Eigene Altersklasse"
                    className="min-h-12 rounded-xl border border-brand-line px-3 text-[16px] outline-none focus:border-brand-red"
                  />
                  {freieAltersklassen.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {freieAltersklassen.map((f) => (
                        <button key={f} type="button" onClick={() => setAkFrei(f)} className="min-h-9 rounded-full bg-brand-bg px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-line">
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {art === "gruppe" && (
                <button
                  type="button"
                  onClick={() => setAkTyp("keine")}
                  aria-pressed={akTyp === "keine"}
                  className={`${OPTION} ${akTyp === "keine" ? "border-brand-red bg-brand-red-wash text-brand-ink" : "border-brand-line bg-white text-brand-ink-soft hover:bg-brand-bg"}`}
                >
                  Keine Altersklasse
                </button>
              )}
            </div>
          ) : schritt === "disziplin" ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[17px] font-bold text-brand-ink">Welche Disziplin?</p>
              {akTyp === "offiziell" && <p className="text-[13px] text-brand-ink-soft">Angezeigt werden nur Disziplinen, die es in der Altersklasse {akText} gibt.</p>}
              {moegliche.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setDisziplinId(d.id);
                    if (d.besetzung === "solo") setTaenzer([]);
                  }}
                  aria-pressed={disziplinId === d.id}
                  className={`${OPTION} ${disziplinId === d.id ? "border-brand-red bg-brand-red-wash text-brand-ink" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"}`}
                >
                  {d.name}
                </button>
              ))}
              {art === "gruppe" && (
                <button
                  type="button"
                  onClick={() => setDisziplinId(null)}
                  aria-pressed={disziplinId === null}
                  className={`${OPTION} ${disziplinId === null ? "border-brand-red bg-brand-red-wash text-brand-ink" : "border-brand-line bg-white text-brand-ink-soft hover:bg-brand-bg"}`}
                >
                  Keine Disziplin (später festlegen)
                </button>
              )}
            </div>
          ) : schritt === "taenzer" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[17px] font-bold text-brand-ink">{art === "gruppe" ? "Wer gehört zu dieser Gruppe?" : art === "paar" ? "Wer tanzt als Paar?" : "Wer tanzt?"}</p>
              {personen === null ? (
                <p className="flex items-center gap-2 text-[14px] text-brand-ink-soft">
                  <Loader2 size={18} className="animate-spin" /> Mitglieder werden geladen …
                </p>
              ) : art === "paar" ? (
                <>
                  {EinePerson({ titel: "Weiblich", kandidaten: p.filter((x) => x.geschlecht === "weiblich"), wert: weiblich[0] ?? null, setze: (id) => setTaenzer([...(id ? [id] : []), ...maennlich.slice(0, 1)]) })}
                  {EinePerson({ titel: "Männlich", kandidaten: p.filter((x) => x.geschlecht === "männlich"), wert: maennlich[0] ?? null, setze: (id) => setTaenzer([...weiblich.slice(0, 1), ...(id ? [id] : [])]) })}
                  <p className={`rounded-xl px-3.5 py-2.5 text-[14px] font-semibold ${weiblich.length === 1 && maennlich.length === 1 ? "bg-brand-green-wash text-brand-green" : "bg-brand-bg text-brand-ink-soft"}`}>
                    {weiblich.length === 1 && maennlich.length === 1 ? "✓ Tanzpaar vollständig" : "Noch unvollständig – du kannst die Personen auch später ergänzen."}
                  </p>
                </>
              ) : art === "solo" ? (
                EinePerson({ titel: disziplin?.name ?? "Solist", kandidaten: p.filter((x) => (soloGeschlecht ? x.geschlecht === soloGeschlecht : true)), wert: taenzer[0] ?? null, setze: (id) => setTaenzer(id ? [id] : []) })
              ) : (
                <>
                  {PersonenListe({ kandidaten: p, gewaehlt: taenzer, setze: setTaenzer, andere: aufgaben("taenzer"), alleKnopf: true })}
                  {/gemischt/i.test(disziplin?.name ?? "") && (
                    <p className="rounded-xl bg-brand-bg px-3.5 py-2.5 text-[13px] text-brand-ink">
                      Gemischte Garde: {weiblich.length} weiblich · {maennlich.length} männlich
                      {taenzer.length > 0 && (weiblich.length === 0 || maennlich.length === 0) ? " – für eine gemischte Garde werden weibliche und männliche Tänzer gebraucht." : ""}
                    </p>
                  )}
                </>
              )}
              <p className="text-[13px] font-semibold text-brand-ink">
                {taenzer.length} {teilnehmerWort} ausgewählt
              </p>
            </div>
          ) : schritt === "trainer" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[17px] font-bold text-brand-ink">Wer trainiert {art === "gruppe" ? "diese Gruppe" : "hier"}?</p>
              <p className="text-[13px] text-brand-ink-soft">Mitglieder mit der Rolle Trainer oder Vereinsadmin. Trainer können mehreren Gruppen zugeordnet sein.</p>
              {personen === null ? (
                <Loader2 size={18} className="animate-spin text-brand-ink-soft" />
              ) : (
                PersonenListe({ kandidaten: p.filter((x) => x.familie === "trainer" || x.familie === "admin"), gewaehlt: trainer, setze: setTrainer, andere: aufgaben("trainer") })
              )}
            </div>
          ) : schritt === "betreuer" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[17px] font-bold text-brand-ink">Wer betreut {art === "gruppe" ? "diese Gruppe" : "hier"}? (optional)</p>
              {personen === null ? (
                <Loader2 size={18} className="animate-spin text-brand-ink-soft" />
              ) : (
                PersonenListe({
                  kandidaten: p.filter((x) => ["betreuer", "trainer", "admin"].includes(x.familie)),
                  gewaehlt: betreuer,
                  setze: setBetreuer,
                  andere: aufgaben("betreuer"),
                })
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[17px] font-bold text-brand-ink">Übersicht</p>
              <dl className="flex flex-col divide-y divide-brand-line rounded-2xl border border-brand-line">
                {(
                  [
                    ["name", art === "gruppe" ? "Gruppe" : art === "paar" ? "Tanzpaar" : "Solist", name.trim() || "–"],
                    ["altersklasse", "Altersklasse", akText],
                    ["disziplin", "Disziplin", disziplin?.name ?? "keine"],
                    ["taenzer", teilnehmerWort, taenzer.length > 0 ? `${taenzer.length}${art !== "gruppe" ? ` (${taenzer.map(name0).join(", ")})` : ""}` : "0"],
                    ["trainer", "Trainer", String(trainer.length)],
                    ["betreuer", "Betreuer", String(betreuer.length)],
                  ] as [AssistentSchritt, string, string][]
                ).map(([s, label, wert]) => (
                  <div key={s} className="flex items-center gap-3 px-4 py-3">
                    <dt className="w-[34%] shrink-0 text-[13px] text-brand-ink-soft">{label}</dt>
                    <dd className="min-w-0 flex-1 text-[15px] font-semibold text-brand-ink [overflow-wrap:anywhere]">{wert}</dd>
                    <button type="button" onClick={() => setSchritt(s)} className="shrink-0 text-[13px] font-semibold text-brand-red">
                      Ändern
                    </button>
                  </div>
                ))}
              </dl>
              {art === "paar" && !(weiblich.length === 1 && maennlich.length === 1) && (
                <p className="text-[13px] text-brand-ink-soft">Hinweis: Das Tanzpaar ist noch unvollständig.</p>
              )}
            </div>
          )}
          {fehler && !fertig && <p className="form-error mt-3">{fehler}</p>}
        </div>

        {/* Fuss: Weiter / Speichern */}
        {fertig === null && (
          <div className="flex shrink-0 gap-2 border-t border-brand-line px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 sm:px-5">
            {index > 0 && (
              <button type="button" onClick={zurueck} className={`${GROSS} border border-brand-line bg-white text-brand-ink`}>
                Zurück
              </button>
            )}
            {schritt === "uebersicht" ? (
              <button type="button" disabled={laeuft} onClick={speichern} className={`${GROSS} flex-1 bg-brand-red text-white hover:bg-brand-red-deep`}>
                {laeuft && <Loader2 size={18} className="animate-spin" />}
                {bearbeiten ? "Änderungen speichern" : art === "gruppe" ? "Gruppe erstellen" : art === "paar" ? "Tanzpaar erstellen" : "Solist erstellen"}
              </button>
            ) : (
              <button type="button" onClick={weiter} className={`${GROSS} flex-1 bg-brand-red text-white hover:bg-brand-red-deep`}>
                {schritt === "betreuer" && betreuer.length === 0 ? "Überspringen" : "Weiter"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return bereit ? createPortal(inhalt, document.body) : null;
}
