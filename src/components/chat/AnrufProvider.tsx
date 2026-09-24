"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { farbeFuer, initialen } from "./ChatAvatar";

type Art = "audio" | "video";
type Phase = "waehlt" | "klingelt" | "eingehend" | "verbindet" | "aktiv";
type Anruf = { id: string; gespraechId: string; art: Art; partnerName: string; rolle: "anrufer" | "angerufener"; phase: Phase; start?: number };

type AnrufKontext = { anrufen: (gespraechId: string, art: Art, partnerName: string) => void; belegt: boolean };
const Kontext = createContext<AnrufKontext | null>(null);

export function useAnruf() {
  return useContext(Kontext);
}

function dauer(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Klingelton / Freizeichen per WebAudio (keine Audiodatei noetig)
function tonGeber() {
  let ctx: AudioContext | null = null;
  let takt: ReturnType<typeof setInterval> | null = null;
  const piep = (frequenz: number, laenge: number) => {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = frequenz;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + laenge);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + laenge);
  };
  return {
    start(art: "klingeln" | "freizeichen") {
      this.stop();
      try {
        ctx = new AudioContext();
      } catch {
        return;
      }
      const spiel = () => {
        if (art === "klingeln") {
          piep(880, 0.35);
          setTimeout(() => piep(660, 0.35), 400);
        } else piep(425, 1);
      };
      spiel();
      takt = setInterval(spiel, art === "klingeln" ? 2000 : 4000);
    },
    stop() {
      if (takt) clearInterval(takt);
      takt = null;
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}

export function AnrufProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [anruf, setAnruf] = useState<Anruf | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [stumm, setStumm] = useState(false);
  const [kameraAus, setKameraAus] = useState(false);
  const [jetzt, setJetzt] = useState(Date.now());
  const anrufRef = useRef<Anruf | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const lokal = useRef<MediaStream | null>(null);
  const fern = useRef<MediaStream | null>(null);
  const puffer = useRef<RTCIceCandidateInit[]>([]);
  const bearbeitet = useRef<Set<number>>(new Set());
  const ton = useRef(tonGeber());
  const lokalVideo = useRef<HTMLVideoElement>(null);
  const fernVideo = useRef<HTMLVideoElement>(null);
  const fernAudio = useRef<HTMLAudioElement>(null);
  const facing = useRef<"user" | "environment">("user");

  const setze = useCallback((a: Anruf | null) => {
    anrufRef.current = a;
    setAnruf(a);
  }, []);

  const aufraeumen = useCallback(() => {
    ton.current.stop();
    pc.current?.close();
    pc.current = null;
    lokal.current?.getTracks().forEach((t) => t.stop());
    lokal.current = null;
    fern.current = null;
    puffer.current = [];
    bearbeitet.current.clear();
    setStumm(false);
    setKameraAus(false);
    setze(null);
  }, [setze]);

  const beenden = useCallback(
    async (text?: string) => {
      const a = anrufRef.current;
      aufraeumen();
      if (text) {
        setHinweis(text);
        setTimeout(() => setHinweis(null), 3500);
      }
      if (a) await supabase.rpc("anruf_status", { p_anruf_id: a.id, p_aktion: "beenden" });
    },
    [aufraeumen, supabase],
  );

  async function iceServer(): Promise<RTCIceServer[]> {
    try {
      const { data } = await supabase.functions.invoke("anruf-ice", { method: "GET" });
      if (data?.iceServers) return data.iceServers;
    } catch {
      /* Fallback */
    }
    return [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
  }

  async function medien(art: Art) {
    const strom = await navigator.mediaDevices.getUserMedia({ audio: true, video: art === "video" ? { facingMode: "user" } : false });
    lokal.current = strom;
    if (lokalVideo.current) lokalVideo.current.srcObject = strom;
    return strom;
  }

  async function verbindungAufbauen(a: Anruf, strom: MediaStream) {
    const verbindung = new RTCPeerConnection({ iceServers: await iceServer() });
    pc.current = verbindung;
    strom.getTracks().forEach((t) => verbindung.addTrack(t, strom));
    verbindung.onicecandidate = (e) => {
      if (e.candidate) supabase.rpc("anruf_signal", { p_anruf_id: a.id, p_typ: "kandidat", p_daten: e.candidate.toJSON() });
    };
    verbindung.ontrack = (e) => {
      fern.current = e.streams[0];
      if (fernVideo.current) fernVideo.current.srcObject = e.streams[0];
      if (fernAudio.current) fernAudio.current.srcObject = e.streams[0];
    };
    verbindung.onconnectionstatechange = () => {
      const zustand = verbindung.connectionState;
      if (zustand === "connected" && anrufRef.current) {
        ton.current.stop();
        setze({ ...anrufRef.current, phase: "aktiv", start: anrufRef.current.start ?? Date.now() });
      } else if (zustand === "failed") {
        beenden("Die Verbindung ist abgebrochen.");
      }
    };
    return verbindung;
  }

  async function signalVerarbeiten(s: { id: number; anruf_id: string; typ: string; daten: RTCSessionDescriptionInit & RTCIceCandidateInit }) {
    const a = anrufRef.current;
    if (!a || s.anruf_id !== a.id || bearbeitet.current.has(s.id)) return;
    bearbeitet.current.add(s.id);
    const v = pc.current;
    if (!v) return;
    if (s.typ === "antwort" && a.rolle === "anrufer") {
      await v.setRemoteDescription(s.daten);
      for (const k of puffer.current.splice(0)) await v.addIceCandidate(k).catch(() => {});
    } else if (s.typ === "kandidat") {
      if (v.remoteDescription) await v.addIceCandidate(s.daten).catch(() => {});
      else puffer.current.push(s.daten);
    }
  }

  const anrufen = useCallback(
    async (gespraechId: string, art: Art, partnerName: string) => {
      if (anrufRef.current) return;
      try {
        const strom = await medien(art);
        const { data: id, error } = await supabase.rpc("anruf_starten", { p_gespraech_id: gespraechId, p_art: art });
        if (error || !id) {
          strom.getTracks().forEach((t) => t.stop());
          setHinweis(error?.message ?? "Der Anruf konnte nicht gestartet werden.");
          setTimeout(() => setHinweis(null), 4000);
          return;
        }
        const a: Anruf = { id: id as string, gespraechId, art, partnerName, rolle: "anrufer", phase: "klingelt" };
        setze(a);
        const v = await verbindungAufbauen(a, strom);
        const angebot = await v.createOffer();
        await v.setLocalDescription(angebot);
        await supabase.rpc("anruf_signal", { p_anruf_id: a.id, p_typ: "angebot", p_daten: { type: angebot.type, sdp: angebot.sdp } });
        ton.current.start("freizeichen");
        setTimeout(() => {
          if (anrufRef.current?.id === a.id && anrufRef.current.phase === "klingelt") beenden("Keine Antwort.");
        }, 45000);
      } catch {
        aufraeumen();
        setHinweis("Kein Zugriff auf Mikrofon bzw. Kamera. Bitte im Browser erlauben.");
        setTimeout(() => setHinweis(null), 4000);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supabase, setze, aufraeumen, beenden],
  );

  async function annehmen() {
    const a = anrufRef.current;
    if (!a) return;
    ton.current.stop();
    try {
      const strom = await medien(a.art);
      const laufend = { ...a, phase: "verbindet" as Phase };
      setze(laufend);
      const v = await verbindungAufbauen(laufend, strom);
      const { data: signale } = await supabase.from("anruf_signale").select("id, anruf_id, typ, daten").eq("anruf_id", a.id).eq("an", userId).order("id");
      const angebot = (signale ?? []).find((s) => s.typ === "angebot");
      if (!angebot) throw new Error("kein Angebot");
      bearbeitet.current.add(angebot.id);
      await v.setRemoteDescription(angebot.daten as RTCSessionDescriptionInit);
      const antwort = await v.createAnswer();
      await v.setLocalDescription(antwort);
      await supabase.rpc("anruf_signal", { p_anruf_id: a.id, p_typ: "antwort", p_daten: { type: antwort.type, sdp: antwort.sdp } });
      await supabase.rpc("anruf_status", { p_anruf_id: a.id, p_aktion: "annehmen" });
      for (const s of (signale ?? []).filter((x) => x.typ === "kandidat")) await signalVerarbeiten(s);
      setTimeout(() => {
        if (anrufRef.current?.id === a.id && anrufRef.current.phase === "verbindet") {
          setHinweis("Die Verbindung wird aufgebaut … Falls es nicht klappt, blockiert evtl. das Netzwerk den Anruf.");
        }
      }, 12000);
    } catch {
      beenden("Der Anruf konnte nicht angenommen werden.");
    }
  }

  async function ablehnen() {
    const a = anrufRef.current;
    aufraeumen();
    if (a) await supabase.rpc("anruf_status", { p_anruf_id: a.id, p_aktion: "ablehnen" });
  }

  // Eingehende Anrufe, Statuswechsel und Signale (RLS: nur eigene Anrufe)
  useEffect(() => {
    const kanal = supabase
      .channel(`anrufe-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anrufe", filter: `angerufener_id=eq.${userId}` }, async ({ new: neu }) => {
        const n = neu as { id: string; gespraech_id: string; art: Art; anrufer_id: string; status: string };
        if (n.status !== "klingelt") return;
        if (anrufRef.current) {
          await supabase.rpc("anruf_status", { p_anruf_id: n.id, p_aktion: "ablehnen" });
          return;
        }
        const { data } = await supabase.rpc("anzeige_namen", { p_user_ids: [n.anrufer_id] });
        const name = (data as { anzeige: string }[] | null)?.[0]?.anzeige ?? "Unbekannt";
        setze({ id: n.id, gespraechId: n.gespraech_id, art: n.art, partnerName: name, rolle: "angerufener", phase: "eingehend" });
        ton.current.start("klingeln");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "anrufe" }, ({ new: neu }) => {
        const n = neu as { id: string; status: string };
        const a = anrufRef.current;
        if (!a || n.id !== a.id) return;
        if (n.status === "aktiv" && a.rolle === "anrufer") {
          ton.current.stop();
          setze({ ...a, phase: a.phase === "aktiv" ? "aktiv" : "verbindet" });
        } else if (["abgelehnt", "beendet", "verpasst", "abgebrochen"].includes(n.status)) {
          aufraeumen();
          setHinweis(n.status === "abgelehnt" && a.rolle === "anrufer" ? "Anruf abgelehnt." : "Anruf beendet.");
          setTimeout(() => setHinweis(null), 3000);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "anruf_signale", filter: `an=eq.${userId}` }, ({ new: neu }) => {
        signalVerarbeiten(neu as { id: number; anruf_id: string; typ: string; daten: RTCSessionDescriptionInit & RTCIceCandidateInit });
      })
      .subscribe();

    // Beim Laden pruefen, ob gerade ein Anruf klingelt (z. B. nach Tippen auf die Push-Nachricht)
    supabase.rpc("mein_eingehender_anruf").then(({ data }) => {
      const a = (data as { id: string; gespraech_id: string; art: Art; anrufer: string }[] | null)?.[0];
      if (a && !anrufRef.current) {
        setze({ id: a.id, gespraechId: a.gespraech_id, art: a.art, partnerName: a.anrufer, rolle: "angerufener", phase: "eingehend" });
        ton.current.start("klingeln");
      }
    });
    return () => {
      supabase.removeChannel(kanal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  useEffect(() => {
    if (anruf?.phase !== "aktiv") return;
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [anruf?.phase]);

  // Streams nach dem Rendern an die Elemente haengen
  useEffect(() => {
    if (lokalVideo.current && lokal.current) lokalVideo.current.srcObject = lokal.current;
    if (fernVideo.current && fern.current) fernVideo.current.srcObject = fern.current;
    if (fernAudio.current && fern.current) fernAudio.current.srcObject = fern.current;
  }, [anruf]);

  useEffect(() => () => aufraeumen(), [aufraeumen]);

  function mikrofon() {
    const neu = !stumm;
    lokal.current?.getAudioTracks().forEach((t) => (t.enabled = !neu));
    setStumm(neu);
  }
  function kamera() {
    const neu = !kameraAus;
    lokal.current?.getVideoTracks().forEach((t) => (t.enabled = !neu));
    setKameraAus(neu);
  }
  async function kameraWechseln() {
    facing.current = facing.current === "user" ? "environment" : "user";
    try {
      const neu = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing.current } });
      const spur = neu.getVideoTracks()[0];
      const sender = pc.current?.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(spur);
      lokal.current?.getVideoTracks().forEach((t) => {
        t.stop();
        lokal.current?.removeTrack(t);
      });
      lokal.current?.addTrack(spur);
      if (lokalVideo.current) lokalVideo.current.srcObject = lokal.current;
    } catch {
      /* nur eine Kamera */
    }
  }

  const wert = useMemo(() => ({ anrufen, belegt: anruf !== null }), [anrufen, anruf]);
  const video = anruf?.art === "video";
  const statusText =
    anruf?.phase === "eingehend"
      ? video
        ? "Eingehender Videoanruf …"
        : "Eingehender Sprachanruf …"
      : anruf?.phase === "klingelt"
        ? "Klingelt …"
        : anruf?.phase === "verbindet" || anruf?.phase === "waehlt"
          ? "Verbindung wird aufgebaut …"
          : anruf?.start
            ? dauer(jetzt - anruf.start)
            : "";

  return (
    <Kontext.Provider value={wert}>
      {children}
      {hinweis && !anruf && (
        <div className="fixed inset-x-0 top-20 z-[70] flex justify-center px-4" role="status">
          <span className="rounded-full bg-brand-navy px-4 py-2 text-[13px] font-medium text-white shadow-lg">{hinweis}</span>
        </div>
      )}
      {anruf && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-brand-navy text-white" role="dialog" aria-modal="true" aria-label={`Anruf mit ${anruf.partnerName}`}>
          <audio ref={fernAudio} autoPlay />
          {video && anruf.phase === "aktiv" ? (
            <video ref={fernVideo} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[url('/tanzraum-chat-hintergrund.webp')] bg-[length:min(90%,560px)] bg-center bg-no-repeat opacity-10" aria-hidden />
          )}
          {video && (
            <video
              ref={lokalVideo}
              autoPlay
              playsInline
              muted
              className={`absolute z-10 rounded-2xl object-cover shadow-xl ${
                anruf.phase === "aktiv" ? "right-4 top-4 h-40 w-28 sm:h-48 sm:w-36" : "inset-0 h-full w-full rounded-none opacity-60"
              } ${kameraAus ? "invisible" : ""} [transform:scaleX(-1)]`}
            />
          )}
          <div className={`relative z-10 flex flex-1 flex-col items-center px-6 pt-[max(3rem,env(safe-area-inset-top))] text-center ${video && anruf.phase === "aktiv" ? "justify-start" : "justify-center"}`}>
            {!(video && anruf.phase === "aktiv") && (
              <span className={`mb-5 flex h-28 w-28 items-center justify-center rounded-full text-[36px] font-bold ${farbeFuer(anruf.partnerName)} ${anruf.phase === "eingehend" || anruf.phase === "klingelt" ? "animate-pulse" : ""}`}>
                {initialen(anruf.partnerName)}
              </span>
            )}
            <div className="text-[24px] font-bold drop-shadow">{anruf.partnerName}</div>
            <div className="mt-1 text-[14px] text-white/80 drop-shadow">{statusText}</div>
            {hinweis && <div className="mt-3 max-w-[320px] text-[12.5px] text-white/70">{hinweis}</div>}
          </div>
          <div className="relative z-10 flex items-center justify-center gap-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6">
            {anruf.phase === "eingehend" ? (
              <>
                <button type="button" onClick={ablehnen} aria-label="Ablehnen" className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-red shadow-lg">
                  <PhoneOff size={28} />
                </button>
                <button type="button" onClick={annehmen} aria-label="Annehmen" className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-brand-green shadow-lg">
                  {video ? <Video size={28} /> : <Phone size={28} />}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={mikrofon} aria-pressed={stumm} aria-label={stumm ? "Mikrofon an" : "Stummschalten"} className={`flex h-14 w-14 items-center justify-center rounded-full ${stumm ? "bg-white text-brand-navy" : "bg-white/15"}`}>
                  {stumm ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                {video && (
                  <>
                    <button type="button" onClick={kamera} aria-pressed={kameraAus} aria-label={kameraAus ? "Kamera an" : "Kamera aus"} className={`flex h-14 w-14 items-center justify-center rounded-full ${kameraAus ? "bg-white text-brand-navy" : "bg-white/15"}`}>
                      {kameraAus ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>
                    <button type="button" onClick={kameraWechseln} aria-label="Kamera wechseln" className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                      <SwitchCamera size={24} />
                    </button>
                  </>
                )}
                <button type="button" onClick={() => beenden()} aria-label="Auflegen" className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-red shadow-lg">
                  <PhoneOff size={28} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Kontext.Provider>
  );
}
