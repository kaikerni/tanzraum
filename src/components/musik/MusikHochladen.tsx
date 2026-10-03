"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { musikAbschliessen, musikVorbereiten } from "@/app/dashboard/musik/actions";
import { MUSIK_ARTEN, MUSIK_ART_LABEL, MUSIK_BUCKET, MUSIK_MAX } from "@/lib/musik";

type Zeile = { name: string; status: "wartet" | "laeuft" | "fertig" | "fehler"; text?: string };
export type GruppeAuswahl = { id: string; name: string };

// Platz reservieren (DB) -> direkt in den privaten Speicher laden -> abschliessen (DB prueft Groesse und Typ)
export function MusikHochladen({ vereinId, gruppen }: { vereinId: string | null; gruppen: GruppeAuswahl[] }) {
  const router = useRouter();
  const eingabe = useRef<HTMLInputElement>(null);
  const [interpret, setInterpret] = useState("");
  const [art, setArt] = useState("training");
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [laeuft, setLaeuft] = useState(false);

  async function hochladen(dateien: File[]) {
    if (dateien.length === 0) return;
    setLaeuft(true);
    setZeilen(dateien.map((d) => ({ name: d.name, status: "wartet" })));
    const setze = (i: number, z: Partial<Zeile>) => setZeilen((alt) => alt.map((x, j) => (j === i ? { ...x, ...z } : x)));
    const supabase = createClient();
    for (const [i, datei] of dateien.entries()) {
      if (datei.size > MUSIK_MAX) {
        setze(i, { status: "fehler", text: "größer als 30 MB" });
        continue;
      }
      const mime = datei.type || (/\.m4a$/i.test(datei.name) ? "audio/mp4" : /\.mp3$/i.test(datei.name) ? "audio/mpeg" : "");
      if (!mime.startsWith("audio/")) {
        setze(i, { status: "fehler", text: "keine Audiodatei" });
        continue;
      }
      setze(i, { status: "laeuft" });
      const r = await musikVorbereiten(vereinId, "", datei.name, datei.size, mime, interpret, art, auswahl);
      if ("error" in r) {
        setze(i, { status: "fehler", text: r.error });
        continue;
      }
      const { error } = await supabase.storage.from(MUSIK_BUCKET).upload(r.pfad, datei, { contentType: mime, upsert: false });
      if (error) {
        setze(i, { status: "fehler", text: "Hochladen fehlgeschlagen" });
        continue;
      }
      const fertig = await musikAbschliessen(r.id);
      if (fertig.error) {
        await supabase.storage.from(MUSIK_BUCKET).remove([r.pfad]);
        setze(i, { status: "fehler", text: fertig.error });
        continue;
      }
      setze(i, { status: "fertig" });
    }
    setLaeuft(false);
    if (eingabe.current) eingabe.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Interpret / Quelle (optional)</span>
          <input value={interpret} onChange={(e) => setInterpret(e.target.value.slice(0, 120))} placeholder="z. B. Mix Juniorengarde 2026" />
        </label>
        <label className="field">
          <span>Verwendung</span>
          <select value={art} onChange={(e) => setArt(e.target.value)}>
            {MUSIK_ARTEN.map((a) => (
              <option key={a} value={a}>
                {MUSIK_ART_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {vereinId && gruppen.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-[12.5px] font-semibold text-brand-ink-soft">Für welche Gruppen? (keine Auswahl = ganzer Verein)</legend>
          <div className="flex flex-wrap gap-1.5">
            {gruppen.map((g) => {
              const an = auswahl.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={an}
                  onClick={() => setAuswahl((a) => (an ? a.filter((x) => x !== g.id) : [...a, g.id]))}
                  className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${an ? "bg-brand-red text-white" : "bg-brand-bg text-brand-ink hover:bg-brand-line"}`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <button
        type="button"
        disabled={laeuft}
        onClick={() => eingabe.current?.click()}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-brand-red px-5 text-[14px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-60"
      >
        <Upload size={17} /> {laeuft ? "Wird hochgeladen …" : "Musik auswählen"}
      </button>
      <input ref={eingabe} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" multiple className="sr-only" onChange={(e) => hochladen(Array.from(e.target.files ?? []))} />
      <p className="text-[12px] text-brand-ink-soft">
        MP3, M4A, WAV, OGG oder FLAC – höchstens 30 MB pro Titel. Lade nur Musik hoch, für die ihr die nötigen Rechte habt.
      </p>
      {zeilen.length > 0 && (
        <ul className="flex flex-col gap-1 text-[13px]">
          {zeilen.map((z, i) => (
            <li key={`${z.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-brand-bg px-3 py-1.5">
              <span className="min-w-0 truncate text-brand-ink">{z.name}</span>
              <span className={`shrink-0 text-[12px] font-semibold ${z.status === "fertig" ? "text-brand-green" : z.status === "fehler" ? "text-brand-red" : "text-brand-ink-soft"}`}>
                {z.status === "wartet" ? "wartet" : z.status === "laeuft" ? "lädt …" : z.status === "fertig" ? "fertig" : z.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
