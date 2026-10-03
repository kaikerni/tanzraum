"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Camera,
  Video,
  Type,
  Smile,
  MapPin,
  AtSign,
  Hash,
  PenLine,
  Music,
  Palette,
  Plus,
  Trash2,
  RotateCw,
  Pencil,
  Eye,
  ArrowLeft,
  Globe,
  Users,
  Eraser,
  Undo2,
  Check,
  Search,
  LocateFixed,
  Play,
  Pause,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { speicherVorpruefung } from "@/lib/speicher";
import {
  spotlightVeroeffentlichen,
  storyMusikAuswahl,
  storyMusikUrl,
  storyOrteSuchen,
  storyOrtVonPosition,
} from "@/app/dashboard/spotlight/actions";
import { nutzerSuchen, type NutzerTreffer } from "@/app/dashboard/netzwerk/actions";
import { bildVerkleinern } from "@/lib/medien/bild";
import { videoVorbereiten, VideoZuGross } from "@/lib/medien/video";
import { HINTERGRUENDE, type Ebene, type Strich, type TextStil } from "@/lib/spotlights/typen";
import { SmileyAuswahl } from "@/components/chat/SmileyAuswahl";
import { EbeneInhalt, StoryEbenen, TEXT_STILE, ebenenStil, useBuehnenGroesse } from "./StoryEbenen";
import { EMOJIS } from "@/lib/chat/emojis";

// Spotlight-Story-Editor. Gehoert immer der angemeldeten Person (kein „Posten als Verein/Gruppe“).
// Elemente sind echte Ebenen ueber Foto/Video/Hintergrund: antippen, ziehen, mit zwei Fingern vergroessern/drehen
// (am Computer: Griff unten rechts oder Mausrad, Umschalt+Mausrad dreht), loeschen. Alles prueft die Datenbank erneut.

type Art = "foto" | "video" | "text";
type Seite = { id: string; art: Art; datei: File | null; url: string | null; hintergrund: string; ebenen: Ebene[] };
type Werkzeug = null | "text" | "sticker" | "emoji" | "standort" | "erwaehnung" | "zeichnen" | "musik" | "hintergrund" | "neueSeite";
type MusikWahl = { titelId: string; titel: string; interpret: string | null; url: string | null; start: number; dauer: number; lautstaerke: number };
type Punkt = { x: number; y: number };
type OhneLage<T> = T extends unknown ? Omit<T, "id" | "x" | "y" | "skala" | "drehung"> : never;

// Normale Smileys: dieselbe Auswahl wie in Chats und Nachrichten
const FARBEN = ["#ffffff", "#111111", "#e11d2e", "#c9921f", "#f2d58c", "#1f9d55", "#3b82f6", "#8a6ff0", "#f472b6"];
const STRICHE = [0.008, 0.016, 0.03];
const MAX_SEITEN = 10;
const neueId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const grenze = (w: number, a: number, b: number) => Math.min(b, Math.max(a, w));

export function SpotlightErstellen({
  userId,
  standardSichtbarkeit,
  nurKontakte,
  onFertig,
  onAbbrechen,
}: {
  userId: string;
  standardSichtbarkeit: "netzwerk" | "kontakte";
  // von den Eltern festgelegt
  nurKontakte: boolean;
  onFertig: () => void;
  onAbbrechen: () => void;
}) {
  const [seiten, setSeiten] = useState<Seite[]>([]);
  const [aktiv, setAktiv] = useState(0);
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [werkzeug, setWerkzeug] = useState<Werkzeug>(null);
  const [textBearbeiten, setTextBearbeiten] = useState<Ebene | null>(null);
  const [musik, setMusik] = useState<MusikWahl | null>(null);
  const [schritt, setSchritt] = useState<"bearbeiten" | "vorschau">("bearbeiten");
  const [sichtbarkeit, setSichtbarkeit] = useState<"netzwerk" | "kontakte">(nurKontakte ? "kontakte" : standardSichtbarkeit);
  const [status, setStatus] = useState<string | null>(null);
  const [fortschritt, setFortschritt] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const fotoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const seite = seiten[aktiv] ?? null;

  // Objekt-URLs aufraeumen
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const seiteAendern = useCallback((f: (s: Seite) => Seite) => setSeiten((alle) => alle.map((s, i) => (i === aktiv ? f(s) : s))), [aktiv]);
  const ebenenAendern = useCallback((f: (e: Ebene[]) => Ebene[]) => seiteAendern((s) => ({ ...s, ebenen: f(s.ebenen) })), [seiteAendern]);

  function seiteHinzufuegen(art: Art, datei: File | null) {
    if (seiten.length >= MAX_SEITEN) return setFehler(`Eine Story hat höchstens ${MAX_SEITEN} Seiten.`);
    if (datei && art === "foto" && !datei.type.startsWith("image/")) return setFehler("Bitte wähle ein Foto.");
    if (datei && art === "video" && !datei.type.startsWith("video/")) return setFehler("Bitte wähle ein Video.");
    setFehler(null);
    const url = datei ? URL.createObjectURL(datei) : null;
    if (url) urls.current.push(url);
    setSeiten((alle) => [...alle, { id: neueId(), art, datei, url, hintergrund: "rot", ebenen: [] }]);
    setAktiv(seiten.length);
    setAuswahl(null);
    setWerkzeug(art === "text" ? "text" : null);
  }

  function ebeneHinzufuegen(e: OhneLage<Ebene> & { x?: number; y?: number }) {
    const neu = { id: neueId(), x: 0.5, y: 0.5, skala: 1, drehung: 0, ...e } as Ebene;
    ebenenAendern((alt) => [...alt.filter((x) => !(neu.typ === "zeichnung" && x.typ === "zeichnung")), neu]);
    setAuswahl(neu.id);
    setWerkzeug(null);
  }

  const hatInhalt = seiten.length > 0;
  const bereit = seiten.length > 0 && seiten.every((s) => s.art !== "text" || s.ebenen.length > 0);

  async function veroeffentlichen() {
    if (!bereit || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    const storyId = neueId();
    const supabase = createClient();
    try {
      for (let i = 0; i < seiten.length; i++) {
        const s = seiten[i];
        const nr = seiten.length > 1 ? ` (Seite ${i + 1} von ${seiten.length})` : "";
        let pfad: string | null = null;
        if (s.art !== "text") {
          if (!s.datei) throw new Error("Bitte wähle zuerst eine Datei.");
          let blob: Blob;
          if (s.art === "foto") {
            setStatus(`Foto wird vorbereitet …${nr}`);
            blob = await bildVerkleinern(s.datei, 1920);
          } else {
            setStatus(`Video wird für TanzRaum vorbereitet …${nr}`);
            setFortschritt(0);
            blob = await videoVorbereiten(s.datei, (a) => setFortschritt(a), 24 * 1024 * 1024);
            setFortschritt(null);
          }
          setStatus(`Wird hochgeladen …${nr}`);
          const endung = blob.type.startsWith("image/") ? (blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg") : blob.type === "video/webm" ? "webm" : blob.type === "video/quicktime" ? "mov" : "mp4";
          pfad = `${userId}/${neueId()}.${endung}`;
          const speicher = await speicherVorpruefung(supabase, "spotlights", pfad, blob.size);
          if (speicher) throw new Error(speicher);
          const { error } = await supabase.storage.from("spotlights").upload(pfad, blob, { contentType: blob.type || (s.art === "foto" ? "image/jpeg" : "video/mp4") });
          if (error) throw new Error("Die Datei konnte nicht hochgeladen werden. Bitte versuche es erneut.");
        }
        setStatus(`Wird veröffentlicht …${nr}`);
        const r = await spotlightVeroeffentlichen({
          mediaPfad: pfad,
          mediaTyp: s.art,
          hintergrund: s.art === "text" ? s.hintergrund : null,
          sichtbarkeit,
          ebenen: s.ebenen,
          musik: musik ? { titelId: musik.titelId, start: musik.start, dauer: musik.dauer, lautstaerke: musik.lautstaerke } : null,
          storyId,
        });
        if (r.error) throw new Error(r.error);
      }
      onFertig();
    } catch (e) {
      setFehler(e instanceof VideoZuGross || e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setStatus(null);
      setFortschritt(null);
    } finally {
      setLaeuft(false);
    }
  }

  function schliessen() {
    if (laeuft) return;
    if (hatInhalt && !confirm("Story verwerfen? Deine Änderungen gehen verloren.")) return;
    onAbbrechen();
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0f1219] text-white" role="dialog" aria-modal="true" aria-label="Spotlight erstellen">
      <input ref={fotoInput} type="file" accept="image/*" hidden onChange={(e) => { seiteHinzufuegen("foto", e.target.files?.[0] ?? null); e.target.value = ""; }} />
      <input ref={videoInput} type="file" accept="video/*" hidden onChange={(e) => { seiteHinzufuegen("video", e.target.files?.[0] ?? null); e.target.value = ""; }} />

      {/* Kopf */}
      <div className="flex min-h-[56px] items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
        {schritt === "vorschau" ? (
          <button type="button" onClick={() => setSchritt("bearbeiten")} disabled={laeuft} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-[14px] font-semibold hover:bg-white/10">
            <ArrowLeft size={18} /> Bearbeiten
          </button>
        ) : (
          <h2 className="flex items-center gap-1.5 text-[16px] font-bold">
            <Sparkles size={17} className="text-[#f2d58c]" /> Neues Spotlight
          </h2>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {schritt === "bearbeiten" && hatInhalt && (
            <button
              type="button"
              disabled={!bereit}
              onClick={() => {
                setAuswahl(null);
                setWerkzeug(null);
                setSchritt("vorschau");
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-[14px] font-bold text-brand-ink disabled:opacity-50"
            >
              <Eye size={16} /> Vorschau
            </button>
          )}
          <button type="button" onClick={schliessen} disabled={laeuft} aria-label="Schließen" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
            <X size={21} />
          </button>
        </div>
      </div>

      {!hatInhalt ? (
        <MedienWahl onFoto={() => fotoInput.current?.click()} onVideo={() => videoInput.current?.click()} onText={() => seiteHinzufuegen("text", null)} fehler={fehler} />
      ) : schritt === "vorschau" ? (
        <StoryVorschau
          seiten={seiten}
          musik={musik}
          sichtbarkeit={sichtbarkeit}
          setSichtbarkeit={setSichtbarkeit}
          nurKontakte={nurKontakte}
          laeuft={laeuft}
          status={status}
          fortschritt={fortschritt}
          fehler={fehler}
          onVeroeffentlichen={veroeffentlichen}
        />
      ) : (
        <>
          <div className="relative flex min-h-0 flex-1 gap-2 px-2 pb-2">
            {seite && (
              <Buehne
                seite={seite}
                auswahl={auswahl}
                setAuswahl={setAuswahl}
                ebenenAendern={ebenenAendern}
                zeichnen={werkzeug === "zeichnen"}
                onZeichnenEnde={() => setWerkzeug(null)}
                onTextBearbeiten={(e) => {
                  setTextBearbeiten(e);
                  setWerkzeug("text");
                }}
              />
            )}
            {/* Werkzeuge */}
            {werkzeug !== "zeichnen" && (
              <div className="absolute right-3 top-1 z-30 flex flex-col gap-1.5 sm:static sm:justify-start">
                {(
                  [
                    ["text", Type, "Text"],
                    ["sticker", Smile, "TanzRaum-Smileys"],
                    ["emoji", "😀", "Emojis"],
                    ["standort", MapPin, "Standort"],
                    ["erwaehnung", AtSign, "Erwähnen"],
                    ["hashtag", Hash, "Hashtag"],
                    ["zeichnen", PenLine, "Zeichnen"],
                    ["musik", Music, "Musik"],
                    ...(seite?.art === "text" ? [["hintergrund", Palette, "Hintergrund"]] : []),
                  ] as [string, typeof Type | string, string][]
                ).map(([id, Icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => {
                      setAuswahl(null);
                      if (id === "hashtag") {
                        setTextBearbeiten({ id: "", typ: "text", text: "#", stil: "kraeftig", farbe: "#ffffff", hinterlegt: true, ausrichtung: "mitte", x: 0.5, y: 0.5, skala: 1, drehung: 0 });
                        setWerkzeug("text");
                      } else {
                        setTextBearbeiten(null);
                        setWerkzeug(id as Werkzeug);
                      }
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-full text-[20px] backdrop-blur ${id === "musik" && musik ? "bg-[#c9921f] text-white" : "bg-black/45 text-white hover:bg-black/65"}`}
                  >
                    {typeof Icon === "string" ? Icon : <Icon size={20} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {fehler && <p className="mx-3 mb-2 rounded-lg bg-white/95 px-3 py-1.5 text-[13px] text-brand-red">{fehler}</p>}

          {/* Seiten */}
          <div className="flex items-center gap-2 overflow-x-auto px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1">
            {seiten.map((s, i) => (
              <div key={s.id} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAktiv(i);
                    setAuswahl(null);
                  }}
                  aria-label={`Seite ${i + 1}`}
                  aria-current={i === aktiv}
                  className={`block h-[68px] w-[40px] overflow-hidden rounded-lg border-2 ${i === aktiv ? "border-[#f2d58c]" : "border-white/25"}`}
                  style={s.art === "text" ? { background: HINTERGRUENDE[s.hintergrund] } : undefined}
                >
                  {s.art === "foto" && s.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.url} alt="" className="h-full w-full object-cover" />
                  )}
                  {s.art === "video" && s.url && <video src={s.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
                </button>
                {i === aktiv && seiten.length > 1 && (
                  <button
                    type="button"
                    aria-label="Seite entfernen"
                    onClick={() => {
                      setSeiten((alle) => alle.filter((_, j) => j !== i));
                      setAktiv(Math.max(0, i - 1));
                    }}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            {seiten.length < MAX_SEITEN && (
              <button
                type="button"
                onClick={() => setWerkzeug("neueSeite")}
                aria-label="Seite hinzufügen"
                className="flex h-[68px] w-[40px] shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-white/40 text-white/80 hover:border-white"
              >
                <Plus size={18} />
              </button>
            )}
            <span className="ml-1 shrink-0 text-[12px] text-white/60">
              {seiten.length === 1 ? "Weitere Seiten hinzufügen (Training → Kostüm → Auftritt)" : `${seiten.length} Seiten`}
            </span>
          </div>

          {/* Werkzeug-Fenster */}
          {werkzeug === "text" && (
            <TextWerkzeug
              start={textBearbeiten}
              onAbbrechen={() => {
                setWerkzeug(null);
                setTextBearbeiten(null);
              }}
              onFertig={(t) => {
                if (textBearbeiten?.id) ebenenAendern((alt) => alt.map((x) => (x.id === textBearbeiten.id ? ({ ...x, ...t } as Ebene) : x)));
                else if (t.text.trim()) ebeneHinzufuegen({ typ: "text", ...t });
                setWerkzeug(null);
                setTextBearbeiten(null);
              }}
            />
          )}
          {werkzeug === "sticker" && (
            <Blatt titel="TanzRaum-Smileys" onSchliessen={() => setWerkzeug(null)}>
              <div className="-mx-4 text-brand-ink">
                <SmileyAuswahl hoehe="h-[260px]" onWahl={(id) => ebeneHinzufuegen({ typ: "sticker", sticker: id })} onEmoji={(em) => ebeneHinzufuegen({ typ: "emoji", emoji: em })} />
              </div>
            </Blatt>
          )}
          {werkzeug === "emoji" && (
            <Blatt titel="Emojis" onSchliessen={() => setWerkzeug(null)}>
              <div className="grid grid-cols-7 gap-1 sm:grid-cols-9">
                {EMOJIS.map((em) => (
                  <button key={em} type="button" onClick={() => ebeneHinzufuegen({ typ: "emoji", emoji: em })} className="flex h-12 items-center justify-center rounded-xl text-[30px] hover:bg-brand-bg" aria-label={em}>
                    {em}
                  </button>
                ))}
              </div>
            </Blatt>
          )}
          {werkzeug === "standort" && <StandortWerkzeug onSchliessen={() => setWerkzeug(null)} onWahl={(ort) => ebeneHinzufuegen({ typ: "standort", ort, y: 0.18 })} />}
          {werkzeug === "erwaehnung" && <ErwaehnungWerkzeug onSchliessen={() => setWerkzeug(null)} onWahl={(t) => ebeneHinzufuegen({ typ: "erwaehnung", user_id: t.userId, name: `@${t.anzeige.replace(/^@/, "")}`, y: 0.75 })} />}
          {werkzeug === "musik" && <MusikWerkzeug wahl={musik} onAendern={setMusik} onSchliessen={() => setWerkzeug(null)} />}
          {werkzeug === "hintergrund" && seite?.art === "text" && (
            <Blatt titel="Hintergrund" onSchliessen={() => setWerkzeug(null)}>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Hintergrund">
                {Object.entries(HINTERGRUENDE).map(([k, farbe]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={seite.hintergrund === k}
                    aria-label={k}
                    onClick={() => seiteAendern((s) => ({ ...s, hintergrund: k }))}
                    style={{ background: farbe }}
                    className={`h-12 w-12 rounded-2xl ${seite.hintergrund === k ? "ring-2 ring-brand-ink ring-offset-2" : ""}`}
                  />
                ))}
              </div>
            </Blatt>
          )}
          {werkzeug === "neueSeite" && (
            <Blatt titel="Seite hinzufügen" onSchliessen={() => setWerkzeug(null)}>
              <div className="grid grid-cols-3 gap-2">
                <WahlKnopf icon={Camera} titel="Foto" onClick={() => { setWerkzeug(null); fotoInput.current?.click(); }} />
                <WahlKnopf icon={Video} titel="Video" onClick={() => { setWerkzeug(null); videoInput.current?.click(); }} />
                <WahlKnopf icon={Type} titel="Text" onClick={() => seiteHinzufuegen("text", null)} />
              </div>
            </Blatt>
          )}
        </>
      )}
    </div>
  );
}

function WahlKnopf({ icon: Icon, titel, onClick }: { icon: typeof Camera; titel: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border border-brand-line text-[14px] font-semibold text-brand-ink hover:border-brand-red hover:bg-brand-red-wash">
      <Icon size={26} className="text-brand-red" /> {titel}
    </button>
  );
}

function MedienWahl({ onFoto, onVideo, onText, fehler }: { onFoto: () => void; onVideo: () => void; onText: () => void; fehler: string | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-center text-[15px] text-white/80">Training, Kostüm, Auftritt, Erfolg … – womit startet deine Story?</p>
      <div className="grid w-full max-w-[460px] grid-cols-3 gap-3">
        {(
          [
            ["Foto", Camera, onFoto, "aufnehmen oder hochladen"],
            ["Video", Video, onVideo, "aufnehmen oder hochladen"],
            ["Text", Type, onText, "mit Hintergrund"],
          ] as const
        ).map(([titel, Icon, klick, info]) => (
          <button
            key={titel}
            type="button"
            onClick={klick}
            className="spotlight-kachel-rahmen flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 p-2 text-[15px] font-bold hover:bg-white/10"
          >
            <Icon size={30} className="text-[#f2d58c]" />
            {titel}
            <span className="text-center text-[11px] font-medium text-white/60">{info}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-[12px] text-white/55">24 Stunden sichtbar · Videos werden im Browser verkleinert</p>
      {fehler && <p className="rounded-lg bg-white/95 px-3 py-1.5 text-[13px] text-brand-red">{fehler}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Buehne mit frei positionierbaren Ebenen
// ---------------------------------------------------------------------------------------------
function Buehne({
  seite,
  auswahl,
  setAuswahl,
  ebenenAendern,
  zeichnen,
  onZeichnenEnde,
  onTextBearbeiten,
}: {
  seite: Seite;
  auswahl: string | null;
  setAuswahl: (id: string | null) => void;
  ebenenAendern: (f: (e: Ebene[]) => Ebene[]) => void;
  zeichnen: boolean;
  onZeichnenEnde: () => void;
  onTextBearbeiten: (e: Ebene) => void;
}) {
  const rahmen = useRef<HTMLDivElement>(null);
  const buehne = useRef<HTMLDivElement>(null);
  const platz = useBuehnenGroesse(rahmen);
  // 9:16 einpassen
  const breite = Math.max(0, Math.min(platz.breite, (platz.hoehe * 9) / 16));
  const hoehe = (breite * 16) / 9;

  const ebenenRef = useRef(seite.ebenen);
  ebenenRef.current = seite.ebenen;
  const zeiger = useRef(new Map<number, Punkt>());
  const geste = useRef<null | { id: string; e0: Ebene; p0: Map<number, Punkt>; modus: "ziehen" | "griff"; mitte?: Punkt }>(null);

  const setze = useCallback(
    (id: string, aenderung: Partial<Ebene>) => ebenenAendern((alt) => alt.map((x) => (x.id === id ? ({ ...x, ...aenderung } as Ebene) : x))),
    [ebenenAendern],
  );
  const loeschen = useCallback(
    (id: string) => {
      ebenenAendern((alt) => alt.filter((x) => x.id !== id));
      setAuswahl(null);
    },
    [ebenenAendern, setAuswahl],
  );

  function gesteStarten(id: string, modus: "ziehen" | "griff", mitte?: Punkt) {
    const e0 = ebenenRef.current.find((x) => x.id === id);
    if (!e0) return;
    geste.current = { id, e0: { ...e0 }, p0: new Map(zeiger.current), modus, mitte };
  }

  function bewegen() {
    const g = geste.current;
    if (!g || breite === 0) return;
    const schluessel = [...g.p0.keys()].filter((k) => zeiger.current.has(k));
    if (schluessel.length === 0) return;
    if (g.modus === "griff" && g.mitte) {
      const p0 = g.p0.get(schluessel[0])!;
      const p = zeiger.current.get(schluessel[0])!;
      const v0 = { x: p0.x - g.mitte.x, y: p0.y - g.mitte.y };
      const v = { x: p.x - g.mitte.x, y: p.y - g.mitte.y };
      const d0 = Math.hypot(v0.x, v0.y) || 1;
      setze(g.id, {
        skala: grenze((g.e0.skala * Math.hypot(v.x, v.y)) / d0, 0.2, 6),
        drehung: g.e0.drehung + ((Math.atan2(v.y, v.x) - Math.atan2(v0.y, v0.x)) * 180) / Math.PI,
      });
      return;
    }
    if (schluessel.length >= 2) {
      const [k1, k2] = schluessel;
      const a0 = g.p0.get(k1)!, b0 = g.p0.get(k2)!, a = zeiger.current.get(k1)!, b = zeiger.current.get(k2)!;
      const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const w0 = Math.atan2(b0.y - a0.y, b0.x - a0.x);
      const w = Math.atan2(b.y - a.y, b.x - a.x);
      const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setze(g.id, {
        x: grenze(g.e0.x + (m.x - m0.x) / breite, -0.2, 1.2),
        y: grenze(g.e0.y + (m.y - m0.y) / hoehe, -0.2, 1.2),
        skala: grenze((g.e0.skala * d) / d0, 0.2, 6),
        drehung: g.e0.drehung + ((w - w0) * 180) / Math.PI,
      });
      return;
    }
    const p0 = g.p0.get(schluessel[0])!;
    const p = zeiger.current.get(schluessel[0])!;
    setze(g.id, { x: grenze(g.e0.x + (p.x - p0.x) / breite, -0.2, 1.2), y: grenze(g.e0.y + (p.y - p0.y) / hoehe, -0.2, 1.2) });
  }

  function zeigerRunter(ev: React.PointerEvent, id?: string, modus: "ziehen" | "griff" = "ziehen") {
    if (zeichnen) return;
    zeiger.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try {
      buehne.current?.setPointerCapture(ev.pointerId);
    } catch {
      /* ohne Capture */
    }
    if (id) {
      ev.stopPropagation();
      setAuswahl(id);
      let mitte: Punkt | undefined;
      if (modus === "griff") {
        const el = buehne.current?.querySelector<HTMLElement>(`[data-ebene="${id}"]`);
        const r = el?.getBoundingClientRect();
        if (r) mitte = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      gesteStarten(id, modus, mitte);
    } else if (geste.current) {
      // zweiter Finger irgendwo auf der Buehne: Pinch/Drehen fuer die gewaehlte Ebene
      gesteStarten(geste.current.id, "ziehen");
    } else {
      setAuswahl(null);
    }
  }

  function zeigerHoch(ev: React.PointerEvent) {
    zeiger.current.delete(ev.pointerId);
    if (!geste.current) return;
    if (zeiger.current.size === 0) geste.current = null;
    else gesteStarten(geste.current.id, "ziehen");
  }

  // Mausrad: vergroessern/verkleinern, mit Umschalt drehen (nur gewaehlte Ebene)
  useEffect(() => {
    const el = buehne.current;
    if (!el) return;
    function rad(ev: WheelEvent) {
      if (!auswahl) return;
      ev.preventDefault();
      const e = ebenenRef.current.find((x) => x.id === auswahl);
      if (!e) return;
      if (ev.shiftKey) setze(auswahl, { drehung: e.drehung + (ev.deltaY > 0 ? 5 : -5) });
      else setze(auswahl, { skala: grenze(e.skala * (ev.deltaY > 0 ? 0.94 : 1.06), 0.2, 6) });
    }
    el.addEventListener("wheel", rad, { passive: false });
    return () => el.removeEventListener("wheel", rad);
  }, [auswahl, setze]);

  // Tastatur: Entf loescht, Pfeile verschieben, +/- skalieren, Q/E drehen
  useEffect(() => {
    function taste(ev: KeyboardEvent) {
      if (!auswahl || zeichnen) return;
      const ziel = ev.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA")) return;
      const e = ebenenRef.current.find((x) => x.id === auswahl);
      if (!e) return;
      const s = ev.shiftKey ? 0.05 : 0.01;
      if (ev.key === "Delete" || ev.key === "Backspace") loeschen(auswahl);
      else if (ev.key === "ArrowLeft") setze(auswahl, { x: e.x - s });
      else if (ev.key === "ArrowRight") setze(auswahl, { x: e.x + s });
      else if (ev.key === "ArrowUp") setze(auswahl, { y: e.y - s });
      else if (ev.key === "ArrowDown") setze(auswahl, { y: e.y + s });
      else if (ev.key === "+") setze(auswahl, { skala: grenze(e.skala * 1.1, 0.2, 6) });
      else if (ev.key === "-") setze(auswahl, { skala: grenze(e.skala / 1.1, 0.2, 6) });
      else if (ev.key === "q") setze(auswahl, { drehung: e.drehung - 5 });
      else if (ev.key === "e") setze(auswahl, { drehung: e.drehung + 5 });
      else return;
      ev.preventDefault();
    }
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [auswahl, zeichnen, setze, loeschen]);

  return (
    <div ref={rahmen} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
      <div
        ref={buehne}
        className="relative overflow-hidden rounded-2xl bg-black [touch-action:none]"
        style={{ width: breite, height: hoehe, background: seite.art === "text" ? HINTERGRUENDE[seite.hintergrund] : undefined }}
        onPointerDown={(ev) => zeigerRunter(ev)}
        onPointerMove={(ev) => {
          if (!zeiger.current.has(ev.pointerId)) return;
          zeiger.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          bewegen();
        }}
        onPointerUp={zeigerHoch}
        onPointerCancel={zeigerHoch}
        data-testid="story-buehne"
      >
        {seite.art === "foto" && seite.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={seite.url} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" />
        )}
        {seite.art === "video" && seite.url && <video src={seite.url} autoPlay muted loop playsInline className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
        {seite.art === "text" && seite.ebenen.length === 0 && (
          <p className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[16px] font-semibold text-white/85">Tippe auf „Aa“, um Text zu schreiben</p>
        )}

        {breite > 0 &&
          seite.ebenen.map((e) => {
            const gewaehlt = auswahl === e.id;
            const gegen = { transform: `scale(${1 / e.skala})` };
            return (
              <div
                key={e.id}
                data-ebene={e.id}
                className={`absolute cursor-move select-none ${zeichnen && e.typ !== "zeichnung" ? "pointer-events-none" : ""}`}
                style={{ ...ebenenStil(e), zIndex: e.typ === "zeichnung" ? 1 : gewaehlt ? 20 : 10 }}
                onPointerDown={(ev) => zeigerRunter(ev, e.id)}
                onDoubleClick={() => e.typ === "text" && onTextBearbeiten(e)}
              >
                <div style={gewaehlt ? { outline: `${2 / e.skala}px dashed rgba(255,255,255,0.9)`, outlineOffset: 6 / e.skala, borderRadius: 8 } : undefined}>
                  <EbeneInhalt e={e} breite={breite} hoehe={hoehe} />
                </div>
                {gewaehlt && !zeichnen && (
                  <>
                    <button
                      type="button"
                      aria-label="Element löschen"
                      onPointerDown={(ev) => ev.stopPropagation()}
                      onClick={() => loeschen(e.id)}
                      className="absolute -left-4 -top-4 flex h-8 w-8 items-center justify-center rounded-full bg-brand-red text-white shadow-lg"
                      style={gegen}
                    >
                      <Trash2 size={15} />
                    </button>
                    {e.typ === "text" && (
                      <button
                        type="button"
                        aria-label="Text bearbeiten"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={() => onTextBearbeiten(e)}
                        className="absolute -right-4 -top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-ink shadow-lg"
                        style={gegen}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Drehen und Größe ändern (ziehen)"
                      onPointerDown={(ev) => zeigerRunter(ev, e.id, "griff")}
                      className="absolute -bottom-4 -right-4 flex h-8 w-8 cursor-nwse-resize items-center justify-center rounded-full bg-[#c9921f] text-white shadow-lg"
                      style={gegen}
                    >
                      <RotateCw size={15} />
                    </button>
                  </>
                )}
              </div>
            );
          })}

        {zeichnen && breite > 0 && <Zeichenflaeche seite={seite} breite={breite} hoehe={hoehe} ebenenAendern={ebenenAendern} onFertig={onZeichnenEnde} />}
      </div>
    </div>
  );
}

// Zeichnen: Striche liegen in einer eigenen Ebene (spaeter verschieb-, skalier- und drehbar)
function Zeichenflaeche({
  seite,
  breite,
  hoehe,
  ebenenAendern,
  onFertig,
}: {
  seite: Seite;
  breite: number;
  hoehe: number;
  ebenenAendern: (f: (e: Ebene[]) => Ebene[]) => void;
  onFertig: () => void;
}) {
  const [farbe, setFarbe] = useState("#ffffff");
  const [staerke, setStaerke] = useState(STRICHE[1]);
  const [radierer, setRadierer] = useState(false);
  const [aktuell, setAktuell] = useState<Strich | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const ebene = seite.ebenen.find((e) => e.typ === "zeichnung") as (Ebene & { typ: "zeichnung" }) | undefined;
  const z = ebene ?? { x: 0.5, y: 0.5, skala: 1, drehung: 0 };

  // Bildschirmpunkt -> Koordinate in der (ggf. verschobenen/gedrehten) Zeichen-Ebene
  function punkt(ev: React.PointerEvent): [number, number] {
    const r = flaeche.current!.getBoundingClientRect();
    const dx = ev.clientX - r.left - z.x * breite;
    const dy = ev.clientY - r.top - z.y * hoehe;
    const w = (-z.drehung * Math.PI) / 180;
    const rx = (dx * Math.cos(w) - dy * Math.sin(w)) / z.skala;
    const ry = (dx * Math.sin(w) + dy * Math.cos(w)) / z.skala;
    return [grenze((rx + breite / 2) / breite, 0, 1), grenze((ry + hoehe / 2) / hoehe, 0, 1)];
  }

  function striche(f: (s: Strich[]) => Strich[]) {
    ebenenAendern((alt) => {
      const vorhanden = alt.find((e) => e.typ === "zeichnung") as (Ebene & { typ: "zeichnung" }) | undefined;
      const neu = f(vorhanden?.striche ?? []);
      const rest = alt.filter((e) => e.typ !== "zeichnung");
      if (neu.length === 0) return rest;
      return [{ ...(vorhanden ?? { id: neueId(), typ: "zeichnung", x: 0.5, y: 0.5, skala: 1, drehung: 0 }), striche: neu } as Ebene, ...rest];
    });
  }

  function radieren(p: [number, number]) {
    striche((alle) => alle.filter((s) => !s.punkte.some(([x, y]) => Math.abs((x - p[0]) * breite) < 14 && Math.abs((y - p[1]) * hoehe) < 14)));
  }

  return (
    <>
      <div
        ref={flaeche}
        className="absolute inset-0 z-40 cursor-crosshair [touch-action:none]"
        aria-label="Zeichenfläche"
        onPointerDown={(ev) => {
          ev.stopPropagation();
          ev.currentTarget.setPointerCapture(ev.pointerId);
          const p = punkt(ev);
          if (radierer) radieren(p);
          else setAktuell({ farbe, breite: staerke, punkte: [p] });
        }}
        onPointerMove={(ev) => {
          if (!(ev.buttons & 1) && ev.pointerType === "mouse") return;
          const p = punkt(ev);
          if (radierer) {
            if (ev.buttons & 1 || ev.pointerType !== "mouse") radieren(p);
            return;
          }
          setAktuell((s) => {
            if (!s) return s;
            const [lx, ly] = s.punkte[s.punkte.length - 1];
            if (Math.abs((lx - p[0]) * breite) + Math.abs((ly - p[1]) * hoehe) < 2.5 || s.punkte.length > 790) return s;
            return { ...s, punkte: [...s.punkte, p] };
          });
        }}
        onPointerUp={() => {
          if (aktuell && aktuell.punkte.length > 1) {
            const fertig = aktuell;
            striche((alle) => [...alle, fertig].slice(-80));
          }
          setAktuell(null);
        }}
      >
        {aktuell && (
          <div className="pointer-events-none absolute" style={ebenenStil({ ...z, id: "neu", typ: "zeichnung", striche: [] } as Ebene)}>
            <EbeneInhalt e={{ id: "neu", typ: "zeichnung", striche: [aktuell], x: 0, y: 0, skala: 1, drehung: 0 }} breite={breite} hoehe={hoehe} />
          </div>
        )}
      </div>
      <div className="absolute inset-x-2 bottom-2 z-50 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-black/70 p-2 backdrop-blur" onPointerDown={(ev) => ev.stopPropagation()}>
        {FARBEN.map((f) => (
          <button
            key={f}
            type="button"
            aria-label={`Farbe ${f}`}
            onClick={() => {
              setFarbe(f);
              setRadierer(false);
            }}
            className={`h-7 w-7 rounded-full border-2 ${farbe === f && !radierer ? "border-white" : "border-white/30"}`}
            style={{ background: f }}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-white/30" />
        {STRICHE.map((b) => (
          <button key={b} type="button" aria-label={`Strichstärke ${b}`} onClick={() => { setStaerke(b); setRadierer(false); }} className={`flex h-8 w-8 items-center justify-center rounded-full ${staerke === b && !radierer ? "bg-white/25" : ""}`}>
            <span className="rounded-full bg-white" style={{ width: 4 + b * 300, height: 4 + b * 300 }} />
          </button>
        ))}
        <button type="button" aria-label="Radierer" aria-pressed={radierer} onClick={() => setRadierer(!radierer)} className={`flex h-8 w-8 items-center justify-center rounded-full ${radierer ? "bg-white text-brand-ink" : "text-white"}`}>
          <Eraser size={17} />
        </button>
        <button type="button" aria-label="Letzten Strich zurücknehmen" onClick={() => striche((alle) => alle.slice(0, -1))} className="flex h-8 w-8 items-center justify-center rounded-full text-white">
          <Undo2 size={17} />
        </button>
        <button type="button" onClick={() => confirm("Zeichnung löschen?") && striche(() => [])} className="rounded-full px-2 text-[12.5px] font-semibold text-white/85">
          Löschen
        </button>
        <button type="button" onClick={onFertig} className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-bold text-brand-ink">
          <Check size={15} /> Fertig
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Werkzeug-Fenster
// ---------------------------------------------------------------------------------------------
function Blatt({ titel, onSchliessen, children }: { titel: string; onSchliessen: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center" onClick={onSchliessen}>
      <div className="max-h-[75dvh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] text-brand-ink shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titel}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[16px] font-bold">{titel}</h3>
          <button type="button" onClick={onSchliessen} aria-label="Schließen" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-bg">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type TextDaten = { text: string; stil: TextStil; farbe: string; hinterlegt: boolean; ausrichtung: "links" | "mitte" | "rechts" };

function TextWerkzeug({ start, onAbbrechen, onFertig }: { start: Ebene | null; onAbbrechen: () => void; onFertig: (t: TextDaten) => void }) {
  const s = start?.typ === "text" ? start : null;
  const [t, setT] = useState<TextDaten>({
    text: s?.text ?? "",
    stil: s?.stil ?? "klassisch",
    farbe: s?.farbe ?? "#ffffff",
    hinterlegt: s?.hinterlegt ?? false,
    ausrichtung: s?.ausrichtung ?? "mitte",
  });
  const vorschau = useMemo(() => ({ id: "v", typ: "text" as const, x: 0.5, y: 0.5, skala: 1, drehung: 0, ...t, text: t.text || "Dein Text" }), [t]);
  return (
    <div className="absolute inset-0 z-[90] flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between p-3">
        <button type="button" onClick={onAbbrechen} className="min-h-10 rounded-xl px-3 text-[14px] font-semibold text-white/85">
          Abbrechen
        </button>
        <button type="button" onClick={() => onFertig(t)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-white px-4 text-[14px] font-bold text-brand-ink">
          <Check size={16} /> Fertig
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <div className="pointer-events-none">
          <EbeneInhalt e={vorschau} breite={340} hoehe={600} />
        </div>
        <textarea
          autoFocus
          value={t.text}
          onChange={(e) => setT({ ...t, text: e.target.value.slice(0, 300) })}
          rows={3}
          maxLength={300}
          placeholder="Schreib etwas … #Gardetanz #TanzRaum"
          className="w-full max-w-[460px] rounded-xl border border-white/25 bg-white/10 p-3 text-[16px] text-white outline-none placeholder:text-white/45 focus:border-white"
          aria-label="Text"
        />
        <div className="flex max-w-[460px] flex-wrap justify-center gap-1.5">
          {TEXT_STILE.map((stil) => (
            <button key={stil.id} type="button" onClick={() => setT({ ...t, stil: stil.id })} className={`min-h-9 rounded-full px-3 text-[13px] font-semibold ${t.stil === stil.id ? "bg-white text-brand-ink" : "bg-white/15 text-white"}`}>
              {stil.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {FARBEN.map((f) => (
            <button key={f} type="button" aria-label={`Farbe ${f}`} onClick={() => setT({ ...t, farbe: f })} className={`h-8 w-8 rounded-full border-2 ${t.farbe === f ? "border-white" : "border-white/25"}`} style={{ background: f }} />
          ))}
          <button type="button" aria-pressed={t.hinterlegt} onClick={() => setT({ ...t, hinterlegt: !t.hinterlegt })} className={`ml-1 min-h-8 rounded-lg px-2.5 text-[12.5px] font-bold ${t.hinterlegt ? "bg-white text-brand-ink" : "bg-white/15 text-white"}`}>
            A▮ hinterlegt
          </button>
          {(["links", "mitte", "rechts"] as const).map((a) => (
            <button key={a} type="button" aria-label={`Ausrichtung ${a}`} onClick={() => setT({ ...t, ausrichtung: a })} className={`min-h-8 rounded-lg px-2 text-[12px] font-semibold ${t.ausrichtung === a ? "bg-white text-brand-ink" : "bg-white/15 text-white"}`}>
              {a === "links" ? "⇤" : a === "mitte" ? "≡" : "⇥"}
            </button>
          ))}
          <button type="button" onClick={() => setT({ ...t, text: `${t.text}${t.text && !t.text.endsWith(" ") ? " " : ""}#` })} className="min-h-8 rounded-lg bg-white/15 px-2.5 text-[13px] font-bold text-white" aria-label="Hashtag einfügen">
            #
          </button>
        </div>
      </div>
    </div>
  );
}

function StandortWerkzeug({ onSchliessen, onWahl }: { onSchliessen: () => void; onWahl: (ort: string) => void }) {
  const [eingabe, setEingabe] = useState("");
  const [orte, setOrte] = useState<string[] | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  async function suchen() {
    if (eingabe.trim().length < 2) return;
    setLaeuft(true);
    const r = await storyOrteSuchen(eingabe);
    setOrte(r.orte);
    if (!r.eingerichtet) setHinweis("Die Ortssuche ist gerade nicht verfügbar – du kannst den Ort selbst eintragen.");
    setLaeuft(false);
  }
  function aktueller() {
    if (!("geolocation" in navigator)) return setHinweis("Dein Gerät stellt keinen Standort bereit.");
    setLaeuft(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Koordinaten werden nur zum Ermitteln des Ortsnamens genutzt und nicht gespeichert
        const ort = await storyOrtVonPosition(pos.coords.latitude, pos.coords.longitude);
        setLaeuft(false);
        if (ort) setOrte([ort]);
        else setHinweis("Der Ort konnte nicht ermittelt werden. Suche ihn oder trage ihn selbst ein.");
      },
      () => {
        setLaeuft(false);
        setHinweis("Standortzugriff wurde nicht erlaubt.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  return (
    <Blatt titel="Standort hinzufügen" onSchliessen={onSchliessen}>
      <p className="mb-2 text-[12.5px] text-brand-ink-soft">Veröffentlicht wird nur der Ortsname, den du auswählst – keine Adresse, keine Koordinaten.</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          suchen();
        }}
      >
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl bg-brand-bg px-3">
          <Search size={16} className="text-brand-ink-soft" />
          <input value={eingabe} onChange={(e) => setEingabe(e.target.value)} placeholder="Ort, Halle, Verein …" className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" aria-label="Standort suchen" />
        </label>
        <button type="submit" disabled={laeuft} className="min-h-11 rounded-xl bg-brand-navy px-4 text-[13.5px] font-semibold text-white disabled:opacity-50">
          Suchen
        </button>
      </form>
      <button type="button" onClick={aktueller} disabled={laeuft} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line px-3 text-[13.5px] font-semibold">
        <LocateFixed size={16} className="text-brand-red" /> Aktuellen Standort verwenden
      </button>
      {hinweis && <p className="mt-2 text-[12.5px] text-brand-ink-soft">{hinweis}</p>}
      <ul className="mt-2 flex flex-col">
        {(orte ?? []).map((o) => (
          <li key={o}>
            <button type="button" onClick={() => onWahl(o)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left text-[14.5px] hover:bg-brand-bg">
              <MapPin size={16} className="text-brand-red" /> {o}
            </button>
          </li>
        ))}
        {eingabe.trim().length >= 2 && (
          <li>
            <button type="button" onClick={() => onWahl(eingabe.trim().slice(0, 80))} className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left text-[14px] text-brand-ink-soft hover:bg-brand-bg">
              <Plus size={16} /> „{eingabe.trim().slice(0, 80)}“ übernehmen
            </button>
          </li>
        )}
      </ul>
    </Blatt>
  );
}

function ErwaehnungWerkzeug({ onSchliessen, onWahl }: { onSchliessen: () => void; onWahl: (t: NutzerTreffer) => void }) {
  const [eingabe, setEingabe] = useState("");
  const [treffer, setTreffer] = useState<NutzerTreffer[] | null>(null);
  useEffect(() => {
    const q = eingabe.trim();
    if (q.replace(/^@/, "").length < 3) return setTreffer(null);
    let aktiv = true;
    const t = setTimeout(async () => {
      const r = await nutzerSuchen(q);
      if (aktiv) setTreffer(r.filter((x) => x.darfSchreiben));
    }, 300);
    return () => {
      aktiv = false;
      clearTimeout(t);
    };
  }, [eingabe]);
  return (
    <Blatt titel="Person erwähnen" onSchliessen={onSchliessen}>
      <label className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-bg px-3">
        <AtSign size={16} className="text-brand-ink-soft" />
        <input autoFocus value={eingabe} onChange={(e) => setEingabe(e.target.value)} placeholder="Name oder @Nutzername" className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" aria-label="Person suchen" />
      </label>
      <p className="mt-2 text-[12px] text-brand-ink-soft">Erwähnen kannst du Personen, die du auch anschreiben darfst. Sie werden benachrichtigt, wenn sie dein Spotlight sehen können.</p>
      <ul className="mt-2 flex flex-col">
        {treffer?.length === 0 && <li className="px-2 py-3 text-[13.5px] text-brand-ink-soft">Niemand gefunden.</li>}
        {(treffer ?? []).map((t) => (
          <li key={t.userId}>
            <button type="button" onClick={() => onWahl(t)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left text-[14.5px] font-semibold hover:bg-brand-bg">
              @{t.anzeige.replace(/^@/, "")}
              {t.handle && <span className="text-[12.5px] font-normal text-brand-ink-faint">@{t.handle}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Blatt>
  );
}

function MusikWerkzeug({ wahl, onAendern, onSchliessen }: { wahl: MusikWahl | null; onAendern: (m: MusikWahl | null) => void; onSchliessen: () => void }) {
  const [titel, setTitel] = useState<{ id: string; titel: string; interpret: string | null }[] | null>(null);
  const [m, setM] = useState<MusikWahl | null>(wahl);
  const [dauerGesamt, setDauerGesamt] = useState(0);
  const [spielt, setSpielt] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    storyMusikAuswahl().then(setTitel);
  }, []);
  useEffect(() => {
    const a = audio.current;
    if (!a || !m) return;
    a.volume = m.lautstaerke;
  }, [m]);
  useEffect(() => () => audio.current?.pause(), []);

  async function waehlen(t: { id: string; titel: string; interpret: string | null }) {
    const url = await storyMusikUrl(t.id);
    setM({ titelId: t.id, titel: t.titel, interpret: t.interpret, url, start: 0, dauer: 15, lautstaerke: 0.8 });
    setSpielt(false);
  }
  function vorschau() {
    const a = audio.current;
    if (!a || !m) return;
    if (spielt) {
      a.pause();
      setSpielt(false);
      return;
    }
    a.currentTime = m.start;
    a.volume = m.lautstaerke;
    a.play().then(() => setSpielt(true)).catch(() => {});
  }
  return (
    <Blatt titel="Musik hinzufügen" onSchliessen={onSchliessen}>
      {titel === null ? (
        <p className="text-[13.5px] text-brand-ink-soft">Lädt …</p>
      ) : titel.length === 0 && !m ? (
        <p className="text-[13.5px] text-brand-ink-soft">
          Für Stories kannst du Titel aus der TanzRaum-Musik verwenden (eigene oder die deines Vereins). Gerade sind keine Titel verfügbar – entweder ist der Musikbereich
          ausgeschaltet oder es wurde noch keine Musik hochgeladen.
        </p>
      ) : (
        <>
          {!m && (
            <ul className="flex flex-col">
              {titel.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => waehlen(t)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left hover:bg-brand-bg">
                    <Music size={16} className="text-brand-red" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold">{t.titel}</span>
                      {t.interpret && <span className="block truncate text-[12.5px] text-brand-ink-soft">{t.interpret}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {m && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-brand-bg px-3 py-2">
                <Music size={18} className="text-brand-red" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{m.titel}</span>
                  {m.interpret && <span className="block truncate text-[12.5px] text-brand-ink-soft">{m.interpret}</span>}
                </span>
                <button type="button" onClick={vorschau} disabled={!m.url} aria-label={spielt ? "Vorschau anhalten" : "Vorschau abspielen"} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-red text-white disabled:opacity-50">
                  {spielt ? <Pause size={17} /> : <Play size={17} />}
                </button>
              </div>
              {m.url && (
                <audio
                  ref={audio}
                  src={m.url}
                  preload="metadata"
                  onLoadedMetadata={(e) => setDauerGesamt(e.currentTarget.duration || 0)}
                  onTimeUpdate={(e) => {
                    if (e.currentTarget.currentTime >= m.start + m.dauer) {
                      e.currentTarget.pause();
                      setSpielt(false);
                    }
                  }}
                />
              )}
              <label className="flex flex-col gap-1 text-[13px] font-semibold">
                Ausschnitt ab {Math.floor(m.start / 60)}:{String(Math.floor(m.start % 60)).padStart(2, "0")}
                <input type="range" min={0} max={Math.max(0, Math.floor(dauerGesamt - 3))} step={1} value={m.start} onChange={(e) => setM({ ...m, start: Number(e.target.value) })} className="accent-brand-red" />
              </label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">
                Länge {m.dauer} Sekunden
                <input type="range" min={5} max={30} step={1} value={m.dauer} onChange={(e) => setM({ ...m, dauer: Number(e.target.value) })} className="accent-brand-red" />
              </label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">
                Lautstärke {Math.round(m.lautstaerke * 100)} %
                <input type="range" min={0} max={1} step={0.05} value={m.lautstaerke} onChange={(e) => setM({ ...m, lautstaerke: Number(e.target.value) })} className="accent-brand-red" />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { onAendern(null); onSchliessen(); }} className="min-h-11 flex-1 rounded-xl border border-brand-line text-[14px] font-semibold">
                  Musik entfernen
                </button>
                <button type="button" onClick={() => setM(null)} className="min-h-11 flex-1 rounded-xl border border-brand-line text-[14px] font-semibold">
                  Anderer Titel
                </button>
                <button type="button" onClick={() => { onAendern(m); onSchliessen(); }} className="min-h-11 flex-1 rounded-xl bg-brand-red text-[14px] font-bold text-white">
                  Übernehmen
                </button>
              </div>
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-brand-ink-faint">Die Musik gilt für die ganze Story und ist für alle hörbar, die die Story sehen dürfen.</p>
        </>
      )}
    </Blatt>
  );
}

// ---------------------------------------------------------------------------------------------
// Vorschau: genau so, wie die Story spaeter erscheint
// ---------------------------------------------------------------------------------------------
function StoryVorschau({
  seiten,
  musik,
  sichtbarkeit,
  setSichtbarkeit,
  nurKontakte,
  laeuft,
  status,
  fortschritt,
  fehler,
  onVeroeffentlichen,
}: {
  seiten: Seite[];
  musik: MusikWahl | null;
  sichtbarkeit: "netzwerk" | "kontakte";
  setSichtbarkeit: (s: "netzwerk" | "kontakte") => void;
  nurKontakte: boolean;
  laeuft: boolean;
  status: string | null;
  fortschritt: number | null;
  fehler: string | null;
  onVeroeffentlichen: () => void;
}) {
  const rahmen = useRef<HTMLDivElement>(null);
  const platz = useBuehnenGroesse(rahmen);
  const breite = Math.max(0, Math.min(platz.breite, (platz.hoehe * 9) / 16));
  const hoehe = (breite * 16) / 9;
  const [i, setI] = useState(0);
  const [zeit, setZeit] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const s = seiten[i];

  useEffect(() => {
    setZeit(0);
    if (s.art === "video") return;
    const t = setInterval(() => setZeit((z) => z + 0.05), 50);
    return () => clearInterval(t);
  }, [i, s.art]);
  useEffect(() => {
    if (zeit >= 6) setI((x) => (x + 1) % seiten.length);
  }, [zeit, seiten.length]);
  useEffect(() => {
    const a = audio.current;
    if (!a || !musik) return;
    a.currentTime = musik.start;
    a.volume = musik.lautstaerke;
    a.play().catch(() => {});
    const stopp = setTimeout(() => a.pause(), musik.dauer * 1000);
    return () => {
      clearTimeout(stopp);
      a.pause();
    };
  }, [musik]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:flex-row sm:items-stretch">
      <div ref={rahmen} className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-2xl bg-black"
          style={{ width: breite, height: hoehe, background: s.art === "text" ? HINTERGRUENDE[s.hintergrund] : undefined }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setI((x) => (e.clientX - r.left < r.width / 3 ? Math.max(0, x - 1) : (x + 1) % seiten.length));
          }}
          aria-label="Story-Vorschau"
        >
          <div className="absolute inset-x-2 top-2 z-20 flex gap-1">
            {seiten.map((x, j) => (
              <span key={x.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full bg-white" style={{ width: `${j < i ? 100 : j === i ? Math.min(100, (zeit / 6) * 100) : 0}%` }} />
              </span>
            ))}
          </div>
          {s.art === "foto" && s.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
          )}
          {s.art === "video" && s.url && (
            <video key={s.id} src={s.url} autoPlay muted={!!musik} playsInline className="absolute inset-0 h-full w-full object-contain" onEnded={() => setI((x) => (x + 1) % seiten.length)} />
          )}
          <StoryEbenen ebenen={s.ebenen} breite={breite} hoehe={hoehe} />
          {musik && (
            <span className="absolute bottom-3 left-3 z-20 inline-flex max-w-[80%] items-center gap-1.5 truncate rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-semibold">
              <Music size={13} /> {musik.titel}
            </span>
          )}
          {musik?.url && <audio ref={audio} src={musik.url} preload="auto" />}
        </div>
      </div>
      <div className="flex w-full flex-col gap-2.5 sm:w-[300px] sm:justify-end">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[13px] font-semibold text-white/85">Wer sieht es?</legend>
          {(
            [
              ["netzwerk", Globe, "Alle im TanzRaum-Netzwerk"],
              ["kontakte", Users, "Nur mein Verein & meine Buddys"],
            ] as const
          ).map(([wert, Icon, label]) => (
            <label
              key={wert}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13.5px] ${sichtbarkeit === wert ? "border-[#f2d58c] bg-white/10" : "border-white/20"} ${nurKontakte && wert === "netzwerk" ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input type="radio" name="sichtbarkeit" checked={sichtbarkeit === wert} disabled={nurKontakte && wert === "netzwerk"} onChange={() => setSichtbarkeit(wert)} className="accent-[#c9921f]" />
              <Icon size={16} className="text-white/70" /> {label}
            </label>
          ))}
          {nurKontakte && <p className="text-[12px] text-white/65">Deine Eltern haben festgelegt: nur Verein & Kontakte.</p>}
        </fieldset>
        {status && (
          <div>
            <p className="text-[12.5px] text-white/75">{status}</p>
            {fortschritt !== null && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-[#c9921f] transition-all" style={{ width: `${Math.round(fortschritt * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        {fehler && <p className="rounded-lg bg-white/95 px-3 py-1.5 text-[13px] text-brand-red">{fehler}</p>}
        <button type="button" disabled={laeuft} onClick={onVeroeffentlichen} className="min-h-12 w-full rounded-xl bg-brand-red text-[15px] font-bold text-white hover:bg-brand-red-deep disabled:opacity-60">
          {laeuft ? "Einen Moment …" : "✨ Spotlight veröffentlichen"}
        </button>
      </div>
    </div>
  );
}
