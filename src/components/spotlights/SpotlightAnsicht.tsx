"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, Eye, Trash2, Users, Globe } from "lucide-react";
import { spotlightGesehen, spotlightLoeschen, spotlightReagieren, spotlightsVon } from "@/app/dashboard/netzwerk/spotlight-actions";
import { HINTERGRUENDE, vorZeit, type Spotlight, type SpotlightPerson } from "@/lib/spotlights/typen";
import { SCHNELL_REAKTIONEN, stickerInfo, stickerUrl } from "@/lib/chat/sticker";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";
import { MeldenKnopf } from "@/components/netzwerk/Melden";

const DAUER_MS = 6000;

// Vollbild-Ansicht: Absender ist immer die Person (Profilbild + Name), nie Verein oder Gruppe
export function SpotlightAnsicht({
  personen,
  start,
  onSchliessen,
}: {
  personen: SpotlightPerson[];
  start: number;
  onSchliessen: (geaendert: boolean) => void;
}) {
  const [personIndex, setPersonIndex] = useState(start);
  const [liste, setListe] = useState<Spotlight[] | null>(null);
  const [index, setIndex] = useState(0);
  const [fortschritt, setFortschritt] = useState(0);
  const [pause, setPause] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [, starte] = useTransition();
  const geaendert = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const person = personen[personIndex];
  const aktuell = liste?.[index] ?? null;

  const schliessen = useCallback(() => onSchliessen(geaendert.current), [onSchliessen]);

  // Spotlights der Person laden, beim ersten ungesehenen beginnen
  useEffect(() => {
    let aktiv = true;
    setListe(null);
    setFortschritt(0);
    spotlightsVon(person.userId).then((l) => {
      if (!aktiv) return;
      if (l.length === 0) {
        if (personIndex < personen.length - 1) setPersonIndex(personIndex + 1);
        else schliessen();
        return;
      }
      setListe(l);
      const ersterNeuer = l.findIndex((s) => !s.gesehen);
      setIndex(person.ich || ersterNeuer < 0 ? 0 : ersterNeuer);
    });
    return () => {
      aktiv = false;
    };
  }, [person.userId, person.ich, personIndex, personen.length, schliessen]);

  const weiter = useCallback(() => {
    if (!liste) return;
    setFortschritt(0);
    if (index < liste.length - 1) setIndex(index + 1);
    else if (personIndex < personen.length - 1) setPersonIndex(personIndex + 1);
    else schliessen();
  }, [liste, index, personIndex, personen.length, schliessen]);

  const zurueck = useCallback(() => {
    setFortschritt(0);
    if (index > 0) setIndex(index - 1);
    else if (personIndex > 0) setPersonIndex(personIndex - 1);
  }, [index, personIndex]);

  // Als gesehen markieren
  useEffect(() => {
    if (aktuell && !aktuell.gesehen && !person.ich) {
      geaendert.current = true;
      spotlightGesehen(aktuell.id);
    }
  }, [aktuell, person.ich]);

  // Zeitleiste fuer Fotos/Text (Videos laufen bis zum Ende)
  useEffect(() => {
    if (!aktuell || aktuell.mediaTyp === "video" || pause) return;
    const schritt = 50;
    const t = setInterval(() => {
      setFortschritt((f) => {
        const neu = f + schritt / DAUER_MS;
        if (neu >= 1) {
          clearInterval(t);
          setTimeout(weiter, 0);
          return 1;
        }
        return neu;
      });
    }, schritt);
    return () => clearInterval(t);
  }, [aktuell, pause, weiter]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (pause) v.pause();
    else v.play().catch(() => {});
  }, [pause, aktuell]);

  // Tastatur: Pfeile und Escape
  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (e.key === "ArrowRight") weiter();
      else if (e.key === "ArrowLeft") zurueck();
      else if (e.key === "Escape") schliessen();
    }
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [weiter, zurueck, schliessen]);

  function reagieren(id: string) {
    if (!aktuell) return;
    const neu = aktuell.meineReaktion === id ? null : id;
    setListe((l) => l?.map((s) => (s.id === aktuell.id ? { ...s, meineReaktion: neu } : s)) ?? null);
    starte(async () => {
      const r = await spotlightReagieren(aktuell.id, neu);
      if (r.error) setMeldung(r.error);
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0f1219]/95" role="dialog" aria-modal="true" aria-label={`Spotlights von ${person.name}`}>
      <button type="button" onClick={zurueck} aria-label="Vorheriges" className="mr-4 hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:flex">
        <ChevronLeft size={24} />
      </button>
      <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-black sm:h-[92vh] sm:rounded-3xl">
        {/* Fortschritt */}
        <div className="absolute inset-x-2 top-2 z-20 flex gap-1">
          {(liste ?? [null]).map((s, i) => (
            <span key={s?.id ?? i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full bg-white" style={{ width: `${i < index ? 100 : i === index ? fortschritt * 100 : 0}%` }} />
            </span>
          ))}
        </div>

        {/* Kopf: Profilbild + persoenlicher Name + Zeit */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2.5 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-5">
          <Link href={`/dashboard/netzwerk/person/${person.userId}`} onClick={() => schliessen()} className="flex min-w-0 items-center gap-2.5">
            {person.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.avatarUrl} alt="" className="h-9 w-9 rounded-full border-2 border-white object-cover" />
            ) : (
              <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[13px] font-bold text-white ${farbeFuer(person.name)}`}>
                {initialen(person.name)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold text-white">{person.ich ? "Du" : person.name}</span>
              {aktuell && (
                <span className="flex items-center gap-1 text-[11.5px] text-white/75">
                  {vorZeit(aktuell.erstelltAm)} · {aktuell.sichtbarkeit === "kontakte" ? <Users size={11} /> : <Globe size={11} />}
                </span>
              )}
            </span>
          </Link>
          <button type="button" onClick={() => schliessen()} aria-label="Schließen" className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/15">
            <X size={22} />
          </button>
        </div>

        {/* Inhalt */}
        <div
          className="relative flex flex-1 items-center justify-center"
          onPointerDown={() => setPause(true)}
          onPointerUp={() => setPause(false)}
          onPointerLeave={() => setPause(false)}
        >
          {!aktuell ? (
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" aria-label="Lädt" />
          ) : aktuell.mediaTyp === "text" ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-8 text-center" style={{ background: HINTERGRUENDE[aktuell.hintergrund ?? "rot"] ?? HINTERGRUENDE.rot }}>
              {aktuell.text && (
                <p className={`whitespace-pre-wrap break-words text-[26px] font-extrabold leading-tight ${aktuell.hintergrund === "rosa" || aktuell.hintergrund === "gold" ? "text-brand-ink" : "text-white"}`}>
                  {aktuell.text}
                </p>
              )}
            </div>
          ) : aktuell.mediaTyp === "foto" ? (
            // eslint-disable-next-line @next/next/no-img-element
            aktuell.url ? <img src={aktuell.url} alt="" className="max-h-full w-full object-contain" /> : null
          ) : aktuell.url ? (
            <video
              ref={video}
              key={aktuell.id}
              src={aktuell.url}
              autoPlay
              playsInline
              controls={false}
              className="max-h-full w-full object-contain"
              onTimeUpdate={(e) => setFortschritt(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
              onEnded={weiter}
            />
          ) : null}
          {aktuell?.sticker && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stickerUrl(aktuell.sticker)} alt={stickerInfo(aktuell.sticker)?.name ?? ""} className={`pointer-events-none absolute h-32 w-32 object-contain drop-shadow-xl ${aktuell.mediaTyp === "text" ? "bottom-[22%]" : "bottom-24 right-4"}`} />
          )}
          {aktuell?.mediaTyp !== "text" && aktuell?.text && (
            <p className="pointer-events-none absolute inset-x-4 bottom-24 rounded-xl bg-black/45 px-3 py-2 text-center text-[15px] font-semibold text-white">{aktuell.text}</p>
          )}
          {/* Tippzonen */}
          <button type="button" aria-label="Vorheriges" onClick={zurueck} className="absolute inset-y-16 left-0 w-1/3" />
          <button type="button" aria-label="Nächstes" onClick={weiter} className="absolute inset-y-16 right-0 w-1/3" />
        </div>

        {/* Aktionen */}
        <div className="z-20 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6">
          {meldung && <p className="rounded-lg bg-white/90 px-3 py-1.5 text-[12.5px] text-brand-red">{meldung}</p>}
          {aktuell && person.ich ? (
            <div className="flex items-center gap-2 text-white">
              <span className="inline-flex items-center gap-1.5 text-[13px]">
                <Eye size={16} /> {aktuell.ansichten ?? 0} gesehen
              </span>
              <span className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
                {(aktuell.reaktionen ?? []).slice(0, 12).map((r, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={stickerUrl(r.sticker)} alt="" title={r.name} className="h-8 w-8 object-contain" />
                ))}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!confirm("Dieses Spotlight löschen?")) return;
                  starte(async () => {
                    await spotlightLoeschen(aktuell.id);
                    geaendert.current = true;
                    const rest = liste!.filter((s) => s.id !== aktuell.id);
                    if (rest.length === 0) schliessen();
                    else {
                      setListe(rest);
                      setIndex(Math.min(index, rest.length - 1));
                    }
                  });
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white hover:bg-white/25"
              >
                <Trash2 size={15} /> Löschen
              </button>
            </div>
          ) : aktuell ? (
            <>
              <div className="flex justify-center gap-1 overflow-x-auto" role="group" aria-label="Mit TanzRaum-Smiley reagieren">
                {SCHNELL_REAKTIONEN.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => reagieren(id)}
                    aria-pressed={aktuell.meineReaktion === id}
                    aria-label={stickerInfo(id)?.name}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 ${aktuell.meineReaktion === id ? "bg-white/30 ring-2 ring-white" : ""}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stickerUrl(id)} alt="" className="h-9 w-9 object-contain" />
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/dashboard/netzwerk/person/${person.userId}`}
                  onClick={() => schliessen()}
                  className="inline-flex min-h-10 items-center rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white hover:bg-white/25"
                >
                  Profil öffnen
                </Link>
                <MeldenKnopf spotlightId={aktuell.id} titel="Spotlight melden" hell />
              </div>
            </>
          ) : null}
        </div>

      </div>
      <button type="button" onClick={weiter} aria-label="Nächstes" className="ml-4 hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:flex">
        <ChevronRight size={24} />
      </button>
    </div>
  );
}
