"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Film, Type, X, Globe, Users, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { spotlightErstellen } from "@/app/dashboard/netzwerk/spotlight-actions";
import { bildVerkleinern } from "@/lib/medien/bild";
import { videoVorbereiten, VideoZuGross } from "@/lib/medien/video";
import { HINTERGRUENDE } from "@/lib/spotlights/typen";
import { stickerInfo, stickerUrl } from "@/lib/chat/sticker";
import { SmileyAuswahl } from "@/components/chat/SmileyAuswahl";

type Art = "foto" | "video" | "text";

// Spotlight erstellen: gehoert immer der angemeldeten Person (kein "Posten als Verein/Gruppe")
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
  const [art, setArt] = useState<Art | null>(null);
  const [datei, setDatei] = useState<File | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [hintergrund, setHintergrund] = useState("rot");
  const [sticker, setSticker] = useState<string | null>(null);
  const [smileysOffen, setSmileysOffen] = useState(false);
  const [sichtbarkeit, setSichtbarkeit] = useState<"netzwerk" | "kontakte">(nurKontakte ? "kontakte" : standardSichtbarkeit);
  const [status, setStatus] = useState<string | null>(null);
  const [fortschritt, setFortschritt] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const fotoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (vorschau && URL.revokeObjectURL(vorschau)), [vorschau]);

  function dateiGewaehlt(f: File | undefined, typ: Art) {
    if (!f) return;
    if (typ === "foto" && !f.type.startsWith("image/")) return setFehler("Bitte wähle ein Foto.");
    if (typ === "video" && !f.type.startsWith("video/")) return setFehler("Bitte wähle ein Video.");
    setFehler(null);
    setArt(typ);
    setDatei(f);
    setVorschau(URL.createObjectURL(f));
  }

  async function veroeffentlichen() {
    if (!art || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      let pfad: string | null = null;
      if (art !== "text") {
        if (!datei) throw new Error("Bitte wähle zuerst eine Datei.");
        let blob: Blob;
        if (art === "foto") {
          setStatus("Foto wird vorbereitet …");
          blob = await bildVerkleinern(datei, 1920);
        } else {
          setStatus("Video wird für TanzRaum vorbereitet …");
          setFortschritt(0);
          blob = await videoVorbereiten(datei, (a) => setFortschritt(a));
          setFortschritt(null);
        }
        setStatus("Wird hochgeladen …");
        const endung = blob.type === "image/gif" ? "gif" : blob.type.startsWith("image/") ? "jpg" : blob.type === "video/webm" ? "webm" : blob.type === "video/quicktime" ? "mov" : "mp4";
        pfad = `${userId}/${crypto.randomUUID()}.${endung}`;
        const supabase = createClient();
        const { error } = await supabase.storage.from("spotlights").upload(pfad, blob, { contentType: blob.type || (art === "foto" ? "image/jpeg" : "video/mp4") });
        if (error) throw new Error("Das Hochladen hat nicht geklappt (max. 50 MB). Bitte versuche es erneut.");
      }
      setStatus("Wird veröffentlicht …");
      const r = await spotlightErstellen({ mediaPfad: pfad, mediaTyp: art, text, hintergrund: art === "text" ? hintergrund : null, sticker, sichtbarkeit });
      if (r.error) throw new Error(r.error);
      onFertig();
    } catch (e) {
      setFehler(e instanceof VideoZuGross || e instanceof Error ? e.message : "Das hat nicht geklappt.");
      setStatus(null);
      setFortschritt(null);
    } finally {
      setLaeuft(false);
    }
  }

  const bereit = art === "text" ? !!(text.trim() || sticker) : !!datei;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Spotlight erstellen">
      <div className="flex max-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-brand-line px-4 py-3">
          <h2 className="text-[17px] font-bold text-brand-ink">✨ Neues Spotlight</h2>
          <button type="button" onClick={onAbbrechen} disabled={laeuft} aria-label="Schließen" className="ml-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg">
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <input ref={fotoInput} type="file" accept="image/*" hidden onChange={(e) => dateiGewaehlt(e.target.files?.[0], "foto")} />
          <input ref={videoInput} type="file" accept="video/*" hidden onChange={(e) => dateiGewaehlt(e.target.files?.[0], "video")} />

          {!art ? (
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  ["Foto", Camera, () => fotoInput.current?.click()],
                  ["Video", Film, () => videoInput.current?.click()],
                  ["Text", Type, () => setArt("text")],
                ] as const
              ).map(([titel, Icon, klick]) => (
                <button
                  key={titel}
                  type="button"
                  onClick={klick}
                  className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border border-brand-line text-[14px] font-semibold text-brand-ink hover:border-brand-red hover:bg-brand-red-wash"
                >
                  <Icon size={28} className="text-brand-red" /> {titel}
                </button>
              ))}
              <p className="col-span-3 mt-1 text-center text-[12.5px] text-brand-ink-soft">
                Training, Auftritte, ganze Tänze, Kostüme, Erfolge … 24 Stunden sichtbar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Vorschau */}
              <div
                className="relative flex aspect-[9/14] max-h-[46vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-black"
                style={art === "text" ? { background: HINTERGRUENDE[hintergrund] } : undefined}
              >
                {art === "foto" && vorschau && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vorschau} alt="Vorschau" className="max-h-full w-full object-contain" />
                )}
                {art === "video" && vorschau && <video src={vorschau} controls playsInline className="max-h-full w-full object-contain" />}
                {art === "text" && (
                  <p className={`whitespace-pre-wrap break-words p-6 text-center text-[22px] font-extrabold leading-tight ${hintergrund === "rosa" || hintergrund === "gold" ? "text-brand-ink" : "text-white"}`}>
                    {text || "Dein Text …"}
                  </p>
                )}
                {sticker && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={stickerUrl(sticker)} alt={stickerInfo(sticker)?.name ?? ""} className="pointer-events-none absolute bottom-3 right-3 h-24 w-24 object-contain drop-shadow-lg" />
                )}
                {art !== "text" && (
                  <button
                    type="button"
                    onClick={() => {
                      setArt(null);
                      setDatei(null);
                      setVorschau(null);
                    }}
                    aria-label="Datei entfernen"
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                rows={art === "text" ? 3 : 2}
                placeholder={art === "text" ? "Was möchtest du teilen?" : "Text dazu (optional)"}
                className="rounded-xl border border-brand-line p-3 text-[14.5px] outline-none focus:border-brand-red"
              />

              {art === "text" && (
                <div className="flex gap-2" role="radiogroup" aria-label="Hintergrund">
                  {Object.entries(HINTERGRUENDE).map(([k, farbe]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={hintergrund === k}
                      aria-label={k}
                      onClick={() => setHintergrund(k)}
                      style={{ background: farbe }}
                      className={`h-9 w-9 rounded-full ${hintergrund === k ? "ring-2 ring-brand-ink ring-offset-2" : ""}`}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setSmileysOffen(!smileysOffen)}
                className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-brand-line px-3 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stickerUrl(sticker ?? "t01")} alt="" className="h-7 w-7 object-contain" />
                {sticker ? "Smiley ändern" : "TanzRaum-Smiley hinzufügen"}
              </button>
              {sticker && (
                <button type="button" onClick={() => setSticker(null)} className="-mt-2 self-start text-[12.5px] font-semibold text-brand-red">
                  Smiley entfernen
                </button>
              )}
              {smileysOffen && (
                <div className="-mx-4">
                  <SmileyAuswahl
                    hoehe="h-[200px]"
                    onWahl={(id) => {
                      setSticker(id);
                      setSmileysOffen(false);
                    }}
                  />
                </div>
              )}

              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-[13px] font-semibold text-brand-ink">Wer sieht es?</legend>
                {(
                  [
                    ["netzwerk", Globe, "Alle im TanzRaum-Netzwerk"],
                    ["kontakte", Users, "Nur mein Verein & meine Kontakte"],
                  ] as const
                ).map(([wert, Icon, label]) => (
                  <label
                    key={wert}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13.5px] ${sichtbarkeit === wert ? "border-brand-red bg-brand-red-wash" : "border-brand-line"} ${
                      nurKontakte && wert === "netzwerk" ? "cursor-not-allowed opacity-50" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="sichtbarkeit"
                      checked={sichtbarkeit === wert}
                      disabled={nurKontakte && wert === "netzwerk"}
                      onChange={() => setSichtbarkeit(wert)}
                      className="accent-brand-red"
                    />
                    <Icon size={16} className="text-brand-ink-soft" /> {label}
                  </label>
                ))}
                {nurKontakte && <p className="text-[12px] text-brand-ink-soft">Deine Eltern haben festgelegt: nur Verein & Kontakte.</p>}
              </fieldset>
            </div>
          )}
          {fehler && <p className="form-error mt-3">{fehler}</p>}
        </div>

        {art && (
          <div className="border-t border-brand-line p-3">
            {status && (
              <div className="mb-2">
                <p className="text-[12.5px] text-brand-ink-soft">{status}</p>
                {fortschritt !== null && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-bg">
                    <div className="h-full bg-brand-red transition-all" style={{ width: `${Math.round(fortschritt * 100)}%` }} />
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              disabled={!bereit || laeuft}
              onClick={veroeffentlichen}
              className="min-h-12 w-full rounded-xl bg-brand-red text-[15px] font-bold text-white hover:bg-brand-red-deep disabled:opacity-50"
            >
              {laeuft ? "Einen Moment …" : "✨ Veröffentlichen"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
