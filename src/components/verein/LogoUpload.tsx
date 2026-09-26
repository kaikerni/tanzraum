"use client";

import { useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logoSpeichern } from "@/app/dashboard/verein/actions";

const ERLAUBT = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

// Upload direkt in den Storage-Bucket "verein-logos" (Ordner = Vereins-ID; die Storage-Policy
// erlaubt das nur dem Vereinsadmin), danach wird die oeffentliche URL am Verein gespeichert.
export function LogoUpload({ vereinId }: { vereinId: string }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ fehler?: string; ok?: string; laedt?: boolean }>({});

  async function hochladen(datei: File) {
    if (!ERLAUBT.includes(datei.type)) {
      setStatus({ fehler: "Bitte ein PNG-, JPG-, WebP- oder SVG-Bild wählen." });
      return;
    }
    if (datei.size > 2 * 1024 * 1024) {
      setStatus({ fehler: "Das Logo darf höchstens 2 MB groß sein." });
      return;
    }
    setStatus({ laedt: true });
    const supabase = createClient();
    const endung = datei.name.split(".").pop()?.toLowerCase() || "png";
    const pfad = `${vereinId}/logo-${Date.now()}.${endung}`;
    const { error } = await supabase.storage.from("verein-logos").upload(pfad, datei, {
      contentType: datei.type,
      upsert: false,
    });
    if (error) {
      setStatus({ fehler: "Hochladen fehlgeschlagen – nur der Vereinsadmin darf das Logo ändern." });
      return;
    }
    const { data } = supabase.storage.from("verein-logos").getPublicUrl(pfad);
    const ergebnis = await logoSpeichern(vereinId, data.publicUrl);
    setStatus(ergebnis.error ? { fehler: ergebnis.error } : { ok: "Logo gespeichert." });
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={eingabe}
        type="file"
        accept={ERLAUBT.join(",")}
        className="hidden"
        onChange={(e) => {
          const datei = e.target.files?.[0];
          if (datei) hochladen(datei);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => eingabe.current?.click()}
        disabled={status.laedt}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 py-2 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-60"
      >
        <ImageUp size={16} />
        {status.laedt ? "Wird hochgeladen …" : "Logo hochladen"}
      </button>
      {status.fehler && <p className="form-error">{status.fehler}</p>}
      {status.ok && <p className="text-[12.5px] text-brand-green">{status.ok}</p>}
    </div>
  );
}
