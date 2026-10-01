"use client";

import { useActionState, useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ankuendigungBildUrl } from "@/lib/news/getNews";
import { ankuendigungAnlegen, ankuendigungBeenden, ankuendigungLoeschen } from "@/app/dashboard/admin/ankuendigungen/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

const TYPEN: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Bild (z. B. CD-/Bundle-Cover) direkt in den oeffentlichen Bucket "ankuendigungen" laden (Storage-Policy: nur Plattform-Admins)
export function BildAuswahl() {
  const [pfad, setPfad] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function hochladen(datei: File | undefined) {
    setFehler(null);
    if (!datei) return;
    const endung = TYPEN[datei.type];
    if (!endung) return setFehler("Bitte ein JPG-, PNG- oder WebP-Bild wählen.");
    if (datei.size > 5 * 1024 * 1024) return setFehler("Das Bild darf höchstens 5 MB groß sein.");
    setLaedt(true);
    const neu = `${new Date().getFullYear()}/${crypto.randomUUID()}.${endung}`;
    const { error } = await createClient().storage.from("ankuendigungen").upload(neu, datei, { contentType: datei.type, cacheControl: "31536000" });
    setLaedt(false);
    if (error) return setFehler("Das Bild konnte nicht hochgeladen werden.");
    setPfad(neu);
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="bild_pfad" value={pfad} />
      <span className="text-[13px] font-semibold text-brand-ink">Bild (optional, z. B. Cover einer neuen CD oder eines Bundles)</span>
      {pfad ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ankuendigungBildUrl(pfad) ?? ""} alt="Vorschau" className="h-28 w-28 rounded-xl object-cover" />
          <button type="button" onClick={() => setPfad("")} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-red">
            <X size={14} /> Bild entfernen
          </button>
        </div>
      ) : (
        <label className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-brand-line px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
          <ImagePlus size={16} /> {laedt ? "Wird hochgeladen …" : "Bild auswählen"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={laedt} onChange={(e) => hochladen(e.target.files?.[0])} />
        </label>
      )}
      {fehler && <p className="form-error">{fehler}</p>}
    </div>
  );
}

export function AnkuendigungFormular() {
  const [runde, setRunde] = useState(0);
  const [ergebnis, aktion] = useActionState(async (prev: typeof LEERES_ERGEBNIS, fd: FormData) => {
    // datetime-local -> ISO mit der Zeitzone des Geraets
    for (const feld of ["sichtbar_ab", "sichtbar_bis"]) {
      const w = String(fd.get(`${feld}_lokal`) ?? "");
      fd.set(feld, w ? new Date(w).toISOString() : "");
    }
    const r = await ankuendigungAnlegen(prev, fd);
    if (!r.error) setRunde((x) => x + 1);
    return r;
  }, LEERES_ERGEBNIS);

  return (
    <form key={runde} action={aktion} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Art</span>
          <select name="art" defaultValue="info">
            <option value="info">Information</option>
            <option value="wartung">Wartungsarbeiten</option>
            <option value="neuheit">Neuheit (z. B. neue Musik, neue Funktion)</option>
          </select>
        </label>
        <label className="field">
          <span>Zielgruppe</span>
          <select name="zielgruppe" defaultValue="alle">
            <option value="alle">Alle Nutzer</option>
            <option value="verantwortliche">Vereinsadmins, Trainer, Betreuer</option>
            <option value="ab16">Nur Konten ab 16 (ohne Kinderkonten)</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Titel</span>
        <input name="titel" required maxLength={150} placeholder="z. B. Wartungsarbeiten am Sonntag, 5. Oktober" />
      </label>
      <label className="field">
        <span>Text</span>
        <textarea name="text" rows={4} maxLength={5000} />
      </label>
      <BildAuswahl />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="field">
          <span>Link (optional, z. B. Shop-Seite)</span>
          <input name="link_url" type="url" maxLength={500} placeholder="https://…" pattern="https://.*" />
        </label>
        <label className="field">
          <span>Beschriftung des Links</span>
          <input name="link_text" maxLength={40} placeholder="z. B. Zum Bundle" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Sichtbar ab (leer = sofort)</span>
          <input type="datetime-local" name="sichtbar_ab_lokal" />
        </label>
        <label className="field">
          <span>Sichtbar bis (optional)</span>
          <input type="datetime-local" name="sichtbar_bis_lokal" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="wichtig" /> Wichtig – als Popup, muss bestätigt werden
      </label>
      <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="push" /> Push senden (an alle, die die Kategorie „News“ bzw. „Wichtige News“ aktiviert haben)
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird angelegt …">Ankündigung veröffentlichen</SendenButton>
    </form>
  );
}

export function AnkuendigungAktionen({ id, laeuft: aktiv }: { id: string; laeuft: boolean }) {
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-3 text-[12.5px]">
      {aktiv && (
        <button type="button" disabled={laeuft} onClick={() => starte(async () => setFehler((await ankuendigungBeenden(id)).error))} className="font-semibold text-brand-ink-soft hover:text-brand-ink">
          Beenden
        </button>
      )}
      <button
        type="button"
        disabled={laeuft}
        onClick={() => {
          if (confirm("Ankündigung löschen?")) starte(async () => setFehler((await ankuendigungLoeschen(id)).error));
        }}
        className="font-semibold text-brand-ink-soft hover:text-brand-red"
      >
        Löschen
      </button>
      {fehler && <span className="text-brand-red">{fehler}</span>}
    </span>
  );
}
