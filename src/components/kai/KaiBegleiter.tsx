"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, HelpCircle, Lightbulb, MessageCircleQuestion, Sparkles, Wrench, X } from "lucide-react";
import { KaiFigur } from "@/components/kai/KaiFigur";
import { KaiSprechblase } from "@/components/kai/KaiBuehne";
import { BEGRUESSUNG, einrichtungsSchritte, KAI_UNTERTITEL, NEUIGKEITEN, tippFuer } from "@/lib/kai/inhalte";
import { KAI_FRAGEN, kaiFragen, kaiThemen } from "@/lib/kai/fragen";
import { kaiLesen, kaiSchreiben, type KaiSpeicher } from "@/lib/kai/speicher";
import { aufKaiOeffnen, type KaiModus } from "@/lib/kai/steuerung";
import { NAV, navPfad } from "@/lib/navigation";
import type { KaiAktion, KaiKontext } from "@/lib/kai/typen";

// „✨ Kai – Hilfe?“: der freiwillig aufrufbare Hilfe-Einstieg in der Kopfzeile (ueberall im eingeloggten Bereich).
// Grundsatz: „Wenn du Hilfe brauchst → frag Kai.“ Kai oeffnet sich NIE von selbst – nur per Klick – und laesst sich
// jederzeit schliessen (X, Escape, Tippen daneben). Proaktiv bietet er hoechstens einen Hinweis an: einen roten Punkt
// am Knopf (erster Besuch, wichtige Neuigkeit). Im Fenster: Begruessung, Einrichtungshilfe, Tipp zur aktuellen Seite,
// „Frag Kai“ und Neuigkeiten. Kai ist keine KI – alle Antworten sind fest hinterlegt (src/lib/kai).

const LINK_PRIMAER = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-red px-4 text-[13px] font-semibold text-white hover:bg-brand-red-deep";
const LINK_SEKUNDAER =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-brand-line bg-white px-4 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg";

// Links nur zu Bereichen, die diese Person auch hat
// Unterbereiche mit eigenem Menuepunkt (z. B. „Meine Buddys“ im Netzwerk) muessen selbst freigegeben sein
const EIGENE_MENUEPUNKTE = new Set(NAV.map((n) => navPfad(n.href)));
function erlaubtFuer(k: KaiKontext) {
  const immer = ["/dashboard/einstellungen", "/dashboard/hilfe", "/dashboard/suche", "/dashboard/verein", "/dashboard/neu"];
  const freigegeben = [...immer, ...k.bereiche.map(navPfad)];
  return (href: string) => {
    if (href.startsWith("/#") || href === "/dashboard") return true;
    const pfad = href.split(/[?#]/)[0];
    if (EIGENE_MENUEPUNKTE.has(pfad) && !immer.includes(pfad)) return k.bereiche.map(navPfad).includes(pfad);
    return freigegeben.some((b) => b !== "/dashboard" && (pfad === b || pfad.startsWith(`${b}/`)));
  };
}

// oeffentlich: Anmeldung/Registrierung/Passwort – derselbe Kai, aber nur allgemeine Themen fuer nicht angemeldete
// Besucher (keine Einrichtung, keine Neuigkeiten, keine Links in den angemeldeten Bereich). Ausloeser: Kai-Figur mit Sprechblase.
export function KaiBegleiter({ kontext, oeffentlich = false }: { kontext: KaiKontext; oeffentlich?: boolean }) {
  const pfad = usePathname() ?? "/dashboard";
  const [offen, setOffen] = useState(false);
  const [modus, setModus] = useState<KaiModus>("start");
  const [speicher, setSpeicher] = useState<KaiSpeicher | null>(null);
  const [frage, setFrage] = useState("");
  const [thema, setThema] = useState<string | null>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const fenster = useRef<HTMLDivElement>(null);

  const erlaubt = useMemo(() => erlaubtFuer(kontext), [kontext]);
  const schritte = useMemo(() => einrichtungsSchritte(kontext), [kontext]);
  const tipp = oeffentlich ? null : tippFuer(pfad);
  // Neuigkeiten: zuerst die zentral gepflegten Updates (mit Kai-Hinweis), danach Kais feste Hinweise
  const neuigkeiten = useMemo(() => [...(kontext.neuigkeiten ?? []), ...NEUIGKEITEN], [kontext.neuigkeiten]);
  const ungelesen = speicher ? neuigkeiten.filter((n) => !speicher.gelesen.includes(n.id)) : [];
  const neuesUpdate = ungelesen.find((n) => (kontext.neuigkeiten ?? []).some((k) => k.id === n.id)) ?? null;
  const offeneSchritte = speicher ? schritte.filter((s) => !s.erledigt && !speicher.schritte[s.id]) : [];
  const aktuellerSchritt = offeneSchritte[0] ?? null;
  const schrittNr = aktuellerSchritt ? schritte.findIndex((s) => s.id === aktuellerSchritt.id) + 1 : schritte.length;
  // Proaktiver Hinweis nur als Punkt: erster Besuch oder ungelesene wichtige Neuigkeit
  const markierung = !oeffentlich && !!speicher && !kontext.vorschau && (!speicher.begruesst || ungelesen.some((n) => n.wichtig));

  const oeffnen = useCallback((m: KaiModus = "start") => {
    setModus(m);
    setOffen(true);
  }, []);
  const schliessen = useCallback(() => {
    setOffen(false);
    setSpeicher(kaiSchreiben((s) => ({ ...s, begruesst: true })));
  }, []);

  // Kein automatisches Oeffnen: gespeicherten Stand laden und auf ausdrueckliche Aufrufe (z. B. „Einrichtung starten“) hoeren
  useEffect(() => {
    setSpeicher(kaiLesen());
    return aufKaiOeffnen((m) => oeffnen(m));
  }, [oeffnen]);

  // Seitenwechsel oder Escape schliessen das Fenster (und setzen die Frage zurueck)
  useEffect(() => {
    setOffen(false);
    setFrage("");
    setThema(null);
  }, [pfad]);
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => e.key === "Escape" && schliessen();
    const klick = (e: MouseEvent) => {
      const ziel = e.target as Node;
      if (fenster.current?.contains(ziel) || knopf.current?.contains(ziel)) return;
      schliessen();
    };
    document.addEventListener("keydown", taste);
    document.addEventListener("mousedown", klick);
    fenster.current?.focus();
    return () => {
      document.removeEventListener("keydown", taste);
      document.removeEventListener("mousedown", klick);
    };
  }, [offen, schliessen]);

  function schritt(id: string, status: "erledigt" | "uebersprungen" | null) {
    setSpeicher(
      kaiSchreiben((s) => {
        const neu = { ...s.schritte };
        if (status) neu[id] = status;
        else delete neu[id];
        return { ...s, begruesst: true, schritte: neu };
      }),
    );
  }
  function zurueck() {
    const i = aktuellerSchritt ? schritte.findIndex((s) => s.id === aktuellerSchritt.id) : schritte.length;
    const vorher = schritte[i - 1];
    if (vorher) schritt(vorher.id, null);
  }
  function neuigkeitenGelesen() {
    setSpeicher(kaiSchreiben((s) => ({ ...s, gelesen: [...new Set([...s.gelesen, ...neuigkeiten.map((n) => n.id)])] })));
  }

  const treffer = frage.trim().length >= 2 ? kaiFragen(frage, erlaubt, 3, oeffentlich) : [];
  // Hilfethemen passend zum aktuell geoeffneten Bereich (nur die Route zaehlt – keine KI, keine Schnittstelle)
  const themen = kaiThemen(pfad, erlaubt, oeffentlich ? 8 : 4, oeffentlich);
  const gewaehlt = thema ? KAI_FRAGEN.find((f) => f.id === thema) ?? null : null;

  const aktionLink = (a: KaiAktion | undefined, primaer = false) =>
    a && erlaubt(a.href) ? (
      <Link href={a.href} onClick={() => setOffen(false)} className={primaer ? LINK_PRIMAER : LINK_SEKUNDAER}>
        {a.label} <ChevronRight size={15} />
      </Link>
    ) : null;

  const erstesMal = speicher && !speicher.begruesst;
  const gruss = oeffentlich ? BEGRUESSUNG.oeffentlich : erstesMal ? BEGRUESSUNG.erstes : BEGRUESSUNG.wieder(kontext.vorname);

  return (
    <div className="relative">
      {oeffentlich ? (
        <button
          ref={knopf}
          type="button"
          onClick={() => (offen ? schliessen() : oeffnen("start"))}
          aria-expanded={offen}
          aria-haspopup="dialog"
          aria-label="Fragen? Kai hilft dir gerne!"
          className="group flex items-end gap-1.5 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-red"
        >
          <KaiSprechblase spitze="rechts" className="mb-8 transition-colors group-hover:border-brand-gold sm:mb-12">
            <span className="flex items-center gap-2">
              <span>
                <span className="block text-[15px] font-extrabold">Fragen?</span>
                <span className="block text-[13px] font-medium text-brand-ink-soft">Kai hilft dir gerne!</span>
              </span>
              <ChevronRight size={16} className="text-brand-ink-soft" aria-hidden />
            </span>
          </KaiSprechblase>
          <KaiFigur pose="begruessung" alt="" className="h-36 w-24 transition-transform group-hover:-translate-y-0.5 sm:h-48 sm:w-32 xl:h-56 xl:w-[149px]" sizes="(min-width: 1280px) 149px, 128px" />
        </button>
      ) : (
      <button
        ref={knopf}
        type="button"
        onClick={() => (offen ? schliessen() : oeffnen("start"))}
        aria-expanded={offen}
        aria-haspopup="dialog"
        aria-label={`Kai – Hilfe?${markierung ? " (neuer Hinweis)" : ""}`}
        title="Kai – Hilfe? Wenn du Hilfe brauchst, frag Kai."
        className={`group relative flex h-10 shrink-0 items-center gap-2 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red lg:border lg:border-brand-line lg:bg-white lg:pl-0.5 lg:pr-3.5 lg:hover:border-brand-gold lg:hover:bg-brand-gold-wash ${offen ? "lg:border-brand-gold lg:bg-brand-gold-wash" : ""}`}
      >
        <span className="relative">
          <KaiFigur form="portrait" pose="begruessung" alt="" className="h-9 w-9" sizes="36px" />
          {markierung && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-brand-red ring-2 ring-white" aria-hidden />}
          {/* Handy/Tablet: kleines Schild statt Text – braucht keine zusaetzliche Breite */}
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-ink px-1.5 py-px text-[9px] font-bold leading-tight text-white lg:hidden" aria-hidden>
            Hilfe?
          </span>
        </span>
        <span className="hidden whitespace-nowrap text-[13px] font-semibold text-brand-ink lg:inline">✨ Kai – Hilfe?</span>
      </button>
      )}

      {offen &&
        typeof document !== "undefined" &&
        createPortal(
        <>
          {/* Handy: abgedunkelter Hintergrund, Fenster als Blatt unter der Kopfzeile */}
          <div className="fixed inset-0 z-[60] bg-brand-ink/25 md:hidden" aria-hidden />
          <div
            ref={fenster}
            role="dialog"
            aria-label="Kai – dein TanzRaum-Begleiter"
            tabIndex={-1}
            className={`fixed z-[61] flex flex-col overflow-hidden rounded-2xl border border-brand-line bg-white shadow-[var(--shadow-hover)] outline-none motion-safe:animate-[kai-rein_240ms_ease-out_both] md:inset-x-auto md:right-4 md:w-[400px] ${
              oeffentlich
                ? "inset-x-2 bottom-2 max-h-[calc(100dvh-24px)] md:bottom-4 md:max-h-[calc(100dvh-32px)]"
                : "inset-x-2 top-[68px] max-h-[calc(100dvh-160px)] md:top-[84px] md:max-h-[calc(100dvh-104px)]"
            }`}
          >
            {/* Kopf mit Original-TanzRaum-Logo */}
            <div className="flex items-center gap-3 border-b border-brand-line px-4 py-3">
              <Image src="/tanzraum-logo-mark.webp" alt="TanzRaum" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold leading-tight text-brand-ink">Kai</p>
                <p className="truncate text-[12px] text-brand-ink-soft">{KAI_UNTERTITEL}</p>
              </div>
              <button type="button" onClick={schliessen} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink" aria-label="Kai schließen">
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {modus === "einrichtung" ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-brand-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <Wrench size={13} /> Einrichtung
                      </span>
                      <span>{aktuellerSchritt ? `Schritt ${schrittNr} von ${schritte.length}` : "Fertig"}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-brand-bg">
                      <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${((schritte.length - offeneSchritte.length) / Math.max(1, schritte.length)) * 100}%` }} />
                    </div>
                  </div>
                  {aktuellerSchritt ? (
                    <>
                      <div className="flex items-start gap-3">
                        <KaiFigur form="portrait" pose="erklaeren" alt="" className="h-12 w-12" sizes="48px" />
                        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-brand-bg px-3.5 py-2.5">
                          <p className="break-words text-[15px] font-extrabold text-brand-ink [overflow-wrap:anywhere]">{aktuellerSchritt.titel}</p>
                          <p className="mt-1 text-[13.5px] leading-relaxed text-brand-ink">{aktuellerSchritt.text}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">{aktionLink(aktuellerSchritt.aktion, true)}</div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-line pt-3">
                        <button type="button" onClick={zurueck} disabled={schrittNr <= 1} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink disabled:opacity-40">
                          <ArrowLeft size={15} /> Zurück
                        </button>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => schritt(aktuellerSchritt.id, "uebersprungen")} className={LINK_SEKUNDAER}>
                            Überspringen
                          </button>
                          <button type="button" onClick={() => schritt(aktuellerSchritt.id, "erledigt")} className={LINK_PRIMAER}>
                            <Check size={15} /> Erledigt
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-3">
                      <KaiFigur form="portrait" pose="erfolg" alt="" className="h-12 w-12" sizes="48px" />
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-brand-gold-wash px-3.5 py-2.5">
                        <p className="text-[15px] font-extrabold text-brand-ink">🎉 Geschafft!</p>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-brand-ink">
                          Die wichtigsten Einstellungen sind durch. Du findest mich jederzeit hier oben, wenn du Fragen hast.
                        </p>
                        <button type="button" onClick={() => setSpeicher(kaiSchreiben((s) => ({ ...s, schritte: {} })))} className="mt-2 text-[12.5px] font-semibold text-brand-red">
                          Einrichtung noch einmal durchgehen
                        </button>
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={() => setModus("start")} className="self-start text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
                    ← Zur Übersicht
                  </button>
                </div>
              ) : modus === "neu" ? (
                <div className="flex flex-col gap-3">
                  <p className="inline-flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-brand-red">
                    <Sparkles size={14} /> Neu in TanzRaum
                  </p>
                  <ul className="flex flex-col gap-2">
                    {neuigkeiten.map((n) => (
                      <li key={n.id} className="rounded-xl border border-brand-line px-3.5 py-2.5">
                        <p className="text-[14px] font-bold text-brand-ink">{n.titel}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-brand-ink-soft">{n.text}</p>
                        {n.aktion && erlaubt(n.aktion.href) && (
                          <Link href={n.aktion.href} onClick={() => setOffen(false)} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-red">
                            {n.aktion.label} <ChevronRight size={13} />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => setModus("start")} className="self-start text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
                    ← Zur Übersicht
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Begruessung */}
                  <div className="flex items-start gap-3">
                    <KaiFigur form="portrait" pose="begruessung" alt="" className="h-12 w-12" sizes="48px" />
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-brand-bg px-3.5 py-2.5">
                      <p className="break-words text-[15px] font-extrabold text-brand-ink [overflow-wrap:anywhere]">{gruss.titel}</p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-brand-ink">{gruss.text}</p>
                      {erstesMal && !oeffentlich && <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-ink-soft">{BEGRUESSUNG.erstes.hinweis}</p>}
                    </div>
                  </div>

                  {/* Einrichtung */}
                  {!oeffentlich && (erstesMal || offeneSchritte.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setModus("einrichtung")} className={LINK_PRIMAER}>
                        <Wrench size={15} /> {offeneSchritte.length === schritte.length ? "Einrichtung starten" : "Einrichtung fortsetzen"}
                      </button>
                      {erstesMal && (
                        <button type="button" onClick={schliessen} className={LINK_SEKUNDAER}>
                          Später
                        </button>
                      )}
                      {!erstesMal && (
                        <span className="text-[12.5px] text-brand-ink-soft">
                          {schritte.length - offeneSchritte.length} von {schritte.length} erledigt
                        </span>
                      )}
                    </div>
                  )}

                  {/* Neues TanzRaum-Update: Kai weist nur darauf hin und fuehrt zur Funktion (aendert nichts) */}
                  {!oeffentlich && neuesUpdate && (
                    <section className="rounded-2xl border border-brand-red/25 bg-brand-red-wash/50 px-3.5 py-3">
                      <p className="text-[14px] leading-snug text-brand-ink [overflow-wrap:anywhere]">
                        <strong>✨ Neu bei TanzRaum:</strong> {neuesUpdate.titel}. {neuesUpdate.text}
                      </p>
                      <p className="mt-1 text-[13px] text-brand-ink-soft">Soll ich dir zeigen, wie es funktioniert?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {neuesUpdate.aktion && erlaubt(neuesUpdate.aktion.href) && (
                          <Link href={neuesUpdate.aktion.href} onClick={() => { neuigkeitenGelesen(); setOffen(false); }} className={LINK_PRIMAER}>
                            {neuesUpdate.aktion.label} <ArrowRight size={14} />
                          </Link>
                        )}
                        <button type="button" onClick={neuigkeitenGelesen} className={LINK_SEKUNDAER}>
                          Später
                        </button>
                      </div>
                    </section>
                  )}

                  {/* Tipp zur aktuellen Seite */}
                  {tipp && (
                    <section className="rounded-2xl border border-brand-gold-light bg-brand-gold-wash/60 px-3.5 py-3">
                      <p className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#8a5a00]">
                        <Lightbulb size={13} /> Tipp für diese Seite
                      </p>
                      <p className="mt-1 text-[14.5px] font-bold leading-snug text-brand-ink">{tipp.zeile}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-brand-ink-soft">{tipp.text}</p>
                      {tipp.schritte && (
                        <ol className="mt-2 list-decimal pl-5 text-[13px] leading-relaxed text-brand-ink">
                          {tipp.schritte.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                      )}
                      {tipp.aktion && erlaubt(tipp.aktion.href) && <div className="mt-2.5">{aktionLink(tipp.aktion)}</div>}
                    </section>
                  )}

                  {/* Hilfethemen zum aktuellen Bereich */}
                  {themen.length > 0 && (
                    <section>
                      <p className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-brand-ink-soft">
                        <HelpCircle size={13} /> {tipp ? `Hilfe zu: ${tipp.titel}` : "Häufige Fragen"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {themen.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setThema(thema === f.id ? null : f.id)}
                            aria-pressed={thema === f.id}
                            className={`max-w-full rounded-full px-3 py-1.5 text-left text-[12.5px] font-semibold [overflow-wrap:anywhere] ${thema === f.id ? "bg-brand-ink text-white" : "bg-brand-bg text-brand-ink hover:bg-brand-line"}`}
                          >
                            {f.frage}
                          </button>
                        ))}
                      </div>
                      {gewaehlt && (
                        <div className="mt-2 rounded-xl border border-brand-line px-3.5 py-2.5">
                          <p className="text-[13px] leading-relaxed text-brand-ink">{gewaehlt.antwort}</p>
                          {gewaehlt.aktion && erlaubt(gewaehlt.aktion.href) && (
                            <Link href={gewaehlt.aktion.href} onClick={() => setOffen(false)} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-red">
                              {gewaehlt.aktion.label} <ArrowRight size={13} />
                            </Link>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Frag Kai (feste Antworten, keine KI) */}
                  <section>
                    <label className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-brand-ink-soft" htmlFor="kai-frage">
                      <MessageCircleQuestion size={13} /> Frag Kai
                    </label>
                    <input
                      id="kai-frage"
                      value={frage}
                      onChange={(e) => setFrage(e.target.value)}
                      placeholder={oeffentlich ? "z. B. Wie registriere ich mich?" : "z. B. Wie melde ich mich vom Training ab?"}
                      autoComplete="off"
                      maxLength={120}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 text-[14px] text-brand-ink outline-none placeholder:text-brand-ink-faint focus:border-brand-red"
                    />
                    {frage.trim().length < 2 ? null : treffer.length === 0 ? (
                      oeffentlich ? (
                        <p className="mt-2 rounded-xl bg-brand-bg px-3 py-2.5 text-[13px] text-brand-ink-soft">
                          Dazu habe ich noch keine Antwort. Schreib dem TanzRaum-Team gern über{" "}
                          <Link href="/kontakt" onClick={() => setOffen(false)} className="font-semibold text-brand-red">
                            Kontakt
                          </Link>
                          .
                        </p>
                      ) : (
                      <p className="mt-2 rounded-xl bg-brand-bg px-3 py-2.5 text-[13px] text-brand-ink-soft">
                        Dazu habe ich noch keine Antwort. Schau in{" "}
                        <Link href="/dashboard/hilfe" onClick={() => setOffen(false)} className="font-semibold text-brand-red">
                          Support &amp; Hilfe
                        </Link>{" "}
                        oder nutze die Suche oben.
                      </p>
                      )
                    ) : (
                      <ul className="mt-2 flex flex-col gap-2">
                        {treffer.map((f) => (
                          <li key={f.id} className="rounded-xl border border-brand-line px-3.5 py-2.5">
                            <p className="text-[13.5px] font-bold text-brand-ink">{f.frage}</p>
                            <p className="mt-0.5 text-[13px] leading-relaxed text-brand-ink-soft">{f.antwort}</p>
                            {f.aktion && erlaubt(f.aktion.href) && (
                              <Link href={f.aktion.href} onClick={() => setOffen(false)} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-red">
                                {f.aktion.label} <ArrowRight size={13} />
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Oeffentlich: Kontakt + Startseite statt Neuigkeiten/Support (angemeldeter Bereich) */}
                  {oeffentlich ? (
                    <div className="flex flex-col gap-1 border-t border-brand-line pt-3">
                      <Link href="/kontakt" onClick={() => setOffen(false)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
                        <span className="inline-flex items-center gap-2">
                          <HelpCircle size={16} className="text-brand-red" /> Kontakt zum TanzRaum-Team
                        </span>
                        <ChevronRight size={16} className="text-brand-ink-soft" />
                      </Link>
                      <Link href="/" onClick={() => setOffen(false)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
                        <span className="inline-flex items-center gap-2">
                          <Sparkles size={16} className="text-brand-gold" /> TanzRaum entdecken
                        </span>
                        <ChevronRight size={16} className="text-brand-ink-soft" />
                      </Link>
                    </div>
                  ) : (
                  <div className="flex flex-col gap-1 border-t border-brand-line pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setModus("neu");
                        neuigkeitenGelesen();
                      }}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-left text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Sparkles size={16} className="text-brand-gold" /> Neu in TanzRaum
                      </span>
                      {ungelesen.length > 0 ? (
                        <span className="rounded-full bg-brand-red px-2 py-0.5 text-[11.5px] font-bold text-white">{ungelesen.length} neu</span>
                      ) : (
                        <ChevronRight size={16} className="text-brand-ink-soft" />
                      )}
                    </button>
                    <Link href="/dashboard/hilfe" onClick={() => setOffen(false)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-2 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
                      <span className="inline-flex items-center gap-2">
                        <HelpCircle size={16} className="text-brand-red" /> Support &amp; Hilfe
                      </span>
                      <ChevronRight size={16} className="text-brand-ink-soft" />
                    </Link>
                  </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
