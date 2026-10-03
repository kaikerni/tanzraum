"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadAbschliessen, uploadVorbereiten } from "@/app/dashboard/dateien/actions";

const BUCKET = "vereins-dateien";
const MAX = 50 * 1024 * 1024;
const EINGABE = "w-full rounded-lg border border-brand-line bg-white px-3 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-red";

type Zeile = { name: string; status: "wartet" | "laeuft" | "fertig" | "fehler"; text?: string };

// Mehrere Dateien nacheinander: Platz reservieren (DB) -> direkt in den Speicher laden -> abschliessen (DB prueft Groesse)
export function Hochladen({ vereinId, ordnerVorschlaege }: { vereinId: string | null; ordnerVorschlaege: string[] }) {
  const router = useRouter();
  const eingabe = useRef<HTMLInputElement>(null);
  const [ordner, setOrdner] = useState("");
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [laeuft, setLaeuft] = useState(false);

  async function hochladen(dateien: File[]) {
    if (dateien.length === 0) return;
    setLaeuft(true);
    setZeilen(dateien.map((d) => ({ name: d.name, status: "wartet" })));
    const setze = (i: number, z: Partial<Zeile>) => setZeilen((alt) => alt.map((x, j) => (j === i ? { ...x, ...z } : x)));
    const supabase = createClient();
    for (const [i, datei] of dateien.entries()) {
      if (datei.size > MAX) {
        setze(i, { status: "fehler", text: "größer als 50 MB" });
        continue;
      }
      setze(i, { status: "laeuft" });
      const r = await uploadVorbereiten(vereinId, datei.name, datei.size, datei.type || "application/octet-stream", ordner);
      if ("error" in r) {
        setze(i, { status: "fehler", text: r.error });
        continue;
      }
      const { error } = await supabase.storage.from(BUCKET).upload(r.pfad, datei, { contentType: datei.type || "application/octet-stream", upsert: false });
      if (error) {
        setze(i, { status: "fehler", text: "Hochladen fehlgeschlagen" });
        continue;
      }
      const fertig = await uploadAbschliessen(r.id);
      if (fertig.error) {
        await supabase.storage.from(BUCKET).remove([r.pfad]);
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
    <div id="hochladen" className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
          Ordner (optional)
          <input list="ordner-liste" value={ordner} onChange={(e) => setOrdner(e.target.value.slice(0, 60))} placeholder="z. B. Musik, Satzung, Pläne" className={EINGABE} />
          <datalist id="ordner-liste">
            {ordnerVorschlaege.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => eingabe.current?.click()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-5 text-[14px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-60"
        >
          <Upload size={17} /> {laeuft ? "Wird hochgeladen …" : "Dateien auswählen"}
        </button>
      </div>
      <input ref={eingabe} type="file" multiple className="sr-only" onChange={(e) => hochladen(Array.from(e.target.files ?? []))} />
      <p className="text-[12px] text-brand-ink-soft">Musik, PDFs, Bilder und Dokumente – höchstens 50 MB pro Datei.</p>
      {zeilen.length > 0 && (
        <ul className="flex flex-col gap-1 text-[13px]">
          {zeilen.map((z, i) => (
            <li key={`${z.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-brand-bg px-3 py-1.5">
              <span className="min-w-0 truncate text-brand-ink">{z.name}</span>
              <span
                className={`shrink-0 text-[12px] font-semibold ${z.status === "fertig" ? "text-brand-green" : z.status === "fehler" ? "text-brand-red" : "text-brand-ink-soft"}`}
              >
                {z.status === "wartet" ? "wartet" : z.status === "laeuft" ? "lädt …" : z.status === "fertig" ? "fertig" : z.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
