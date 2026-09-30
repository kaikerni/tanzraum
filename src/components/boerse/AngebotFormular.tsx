"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bildVerkleinern } from "@/lib/medien/bild";
import { angebotSpeichern, bilderEntfernen, type AngebotEingabe } from "@/app/dashboard/boerse/actions";
import { ART_LABEL, ZUSTAND_LABEL, type Angebot, type BoerseArt, type Kategorie, type Zustand } from "@/lib/boerse";

const MAX_BILDER = 8;
const TEXTFELD =
  "rounded-[var(--radius-s)] border border-brand-line px-3 py-2.5 text-[13.5px] font-normal text-brand-ink outline-none focus:border-brand-red";

type Bild = { pfad: string; url: string };

const ARTEN: { art: BoerseArt; text: string; emoji: string }[] = [
  { art: "verkaufen", text: "Ich verkaufe etwas", emoji: "💶" },
  { art: "tauschen", text: "Ich möchte tauschen", emoji: "🔁" },
  { art: "verschenken", text: "Ich verschenke etwas", emoji: "🎁" },
  { art: "suchen", text: "Ich suche etwas", emoji: "🔎" },
];

// Angebot einstellen/bearbeiten. Bilder werden im Browser verkleinert und in den privaten Ordner <user>/<angebot>/ geladen.
export function AngebotFormular({
  userId,
  kategorien,
  angebot,
  bildUrls = {},
}: {
  userId: string;
  kategorien: Kategorie[];
  angebot?: Angebot;
  bildUrls?: Record<string, string>;
}) {
  const router = useRouter();
  const id = useMemo(() => angebot?.id ?? crypto.randomUUID(), [angebot?.id]);
  const [art, setArt] = useState<BoerseArt>(angebot?.art ?? "verkaufen");
  const [kategorie, setKategorie] = useState(angebot?.kategorie ?? "");
  const [bilder, setBilder] = useState<Bild[]>((angebot?.bilder ?? []).map((p) => ({ pfad: p, url: bildUrls[p] ?? "" })));
  const [entfernt, setEntfernt] = useState<string[]>([]);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, starte] = useTransition();
  const dateiFeld = useRef<HTMLInputElement>(null);

  const haupt = kategorien.filter((k) => !k.eltern);
  const unter = kategorien.filter((k) => k.eltern === kategorie);

  async function hochladen(dateien: FileList | null) {
    if (!dateien?.length) return;
    setFehler(null);
    const frei = MAX_BILDER - bilder.length;
    if (frei <= 0) return setFehler(`Höchstens ${MAX_BILDER} Bilder.`);
    setLaedtHoch(true);
    const supabase = createClient();
    const neu: Bild[] = [];
    for (const datei of Array.from(dateien).slice(0, frei)) {
      if (!datei.type.startsWith("image/")) continue;
      try {
        const blob = await bildVerkleinern(datei, 1600);
        const pfad = `${userId}/${id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("boerse").upload(pfad, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        neu.push({ pfad, url: URL.createObjectURL(blob) });
      } catch {
        setFehler("Ein Bild konnte nicht hochgeladen werden (max. 5 MB, JPG/PNG/WebP).");
      }
    }
    setBilder((b) => [...b, ...neu]);
    setLaedtHoch(false);
    if (dateiFeld.current) dateiFeld.current.value = "";
  }

  function absenden(fd: FormData) {
    setFehler(null);
    const eingabe: AngebotEingabe = {
      art,
      kategorie,
      unterkategorie: String(fd.get("unterkategorie") ?? ""),
      titel: String(fd.get("titel") ?? ""),
      beschreibung: String(fd.get("beschreibung") ?? ""),
      preis: String(fd.get("preis") ?? ""),
      preis_vb: fd.get("preis_vb") === "on",
      zustand: String(fd.get("zustand") ?? ""),
      groesse: String(fd.get("groesse") ?? ""),
      ort: String(fd.get("ort") ?? ""),
      versand: fd.get("versand") === "on",
      abholung: fd.get("abholung") === "on",
      tausch_moeglich: fd.get("tausch_moeglich") === "on",
      bilder: bilder.map((b) => b.pfad),
    };
    starte(async () => {
      const r = await angebotSpeichern(id, eingabe);
      if (r.error) {
        setFehler(r.error);
        return;
      }
      if (entfernt.length) await bilderEntfernen(entfernt);
      router.push(`/dashboard/boerse/${id}`);
      router.refresh();
    });
  }

  const preisLabel = art === "suchen" ? "Budget bis (€, optional)" : "Preis (€)";
  return (
    <form action={absenden} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[14px] font-bold text-brand-ink">Was möchtest du?</legend>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {ARTEN.map((x) => (
            <button
              key={x.art}
              type="button"
              onClick={() => setArt(x.art)}
              aria-pressed={art === x.art}
              className={`flex min-h-14 items-center gap-2 rounded-xl border-2 px-3 text-left text-[13.5px] font-semibold ${
                art === x.art ? "border-brand-red bg-brand-red-wash text-brand-ink" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"
              }`}
            >
              <span className="text-[20px]" aria-hidden>
                {x.emoji}
              </span>
              {x.text}
            </button>
          ))}
        </div>
      </fieldset>

      {art !== "suchen" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[14px] font-bold text-brand-ink">Bilder</legend>
          <p className="text-[12.5px] text-brand-ink-soft">Bis zu {MAX_BILDER} Fotos, das erste ist das Titelbild. Bitte keine Personen erkennbar zeigen, die nicht zugestimmt haben.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {bilder.map((b, i) => (
              <div key={b.pfad} className="relative aspect-square overflow-hidden rounded-xl border border-brand-line bg-brand-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {b.url && <img src={b.url} alt="" className="h-full w-full object-cover" />}
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-ink/85 px-2 py-0.5 text-[10.5px] font-bold text-white">Titelbild</span>}
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => setBilder((l) => [l[i], ...l.filter((_, n) => n !== i)])}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow"
                      aria-label="Als Titelbild verwenden"
                    >
                      <Star size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setBilder((l) => l.filter((_, n) => n !== i));
                      setEntfernt((e) => [...e, b.pfad]);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-brand-red shadow"
                    aria-label="Bild entfernen"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
            {bilder.length < MAX_BILDER && (
              <button
                type="button"
                onClick={() => dateiFeld.current?.click()}
                disabled={laedtHoch}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-line bg-white text-[12.5px] font-semibold text-brand-ink-soft hover:border-brand-red hover:text-brand-red"
              >
                {laedtHoch ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
                {laedtHoch ? "Lädt …" : "Foto hinzufügen"}
              </button>
            )}
          </div>
          <input ref={dateiFeld} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void hochladen(e.target.files)} />
        </fieldset>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field sm:col-span-2">
          <span>Titel</span>
          <input name="titel" required minLength={3} maxLength={100} defaultValue={angebot?.titel} placeholder={art === "suchen" ? "z. B. Suche Gardekostüm Größe 134" : "z. B. Gardekostüm Rot/Gold"} />
        </label>
        <label className="field">
          <span>Kategorie</span>
          <select required value={kategorie} onChange={(e) => setKategorie(e.target.value)}>
            <option value="" disabled>
              Bitte wählen …
            </option>
            {haupt.map((k) => (
              <option key={k.schluessel} value={k.schluessel}>
                {k.emoji} {k.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Unterkategorie (optional)</span>
          <select name="unterkategorie" key={kategorie} defaultValue={angebot?.kategorie === kategorie ? (angebot?.unterkategorie ?? "") : ""} disabled={unter.length === 0}>
            <option value="">–</option>
            {unter.map((k) => (
              <option key={k.schluessel} value={k.schluessel}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        {(art === "verkaufen" || art === "suchen") && (
          <label className="field">
            <span>{preisLabel}</span>
            <input
              name="preis"
              inputMode="decimal"
              required={art === "verkaufen"}
              pattern="\d{1,6}([.,]\d{1,2})?"
              defaultValue={angebot?.preis_cent != null ? String(angebot.preis_cent / 100).replace(".", ",") : ""}
              placeholder="z. B. 120"
            />
          </label>
        )}
        {art === "verkaufen" && (
          <label className="flex min-h-10 items-center gap-2 self-end text-[13.5px] font-semibold text-brand-ink">
            <input type="checkbox" name="preis_vb" defaultChecked={angebot?.preis_vb} className="h-4 w-4 accent-brand-red" /> Verhandlungsbasis (VB)
          </label>
        )}
        {art !== "suchen" && (
          <label className="field">
            <span>Zustand</span>
            <select name="zustand" defaultValue={angebot?.zustand ?? ""} required>
              <option value="" disabled>
                Bitte wählen …
              </option>
              {(Object.keys(ZUSTAND_LABEL) as Zustand[]).map((z) => (
                <option key={z} value={z}>
                  {ZUSTAND_LABEL[z]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Größe (optional)</span>
          <input name="groesse" maxLength={40} defaultValue={angebot?.groesse ?? ""} placeholder="z. B. 152, 38, S/M, Kopfumfang 56" />
        </label>
        <label className="field">
          <span>Ort / Region</span>
          <input name="ort" maxLength={80} defaultValue={angebot?.ort ?? ""} placeholder="z. B. Mannheim" />
          <small className="font-normal text-brand-ink-faint">Angezeigt wird nur der Ort – keine Straße, keine Hausnummer.</small>
        </label>
        <label className="field sm:col-span-2">
          <span>Beschreibung</span>
          <textarea
            name="beschreibung"
            rows={6}
            maxLength={3000}
            defaultValue={angebot?.beschreibung ?? ""}
            className={TEXTFELD}
            placeholder={
              art === "tauschen"
                ? "Was bietest du an – und was suchst du im Tausch?"
                : art === "suchen"
                  ? "Was genau suchst du? Größe, Farben, bis wann …"
                  : "Farbe, Maße, Besonderheiten, was dazugehört …"
            }
          />
          <small className="font-normal text-brand-ink-faint">Bitte keine Telefonnummer oder E-Mail – Interessierte schreiben dir über den TanzRaum-Chat.</small>
        </label>
      </div>

      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="mb-1 text-[14px] font-bold text-brand-ink">Übergabe</legend>
        <label className="flex min-h-10 items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
          <input type="checkbox" name="abholung" defaultChecked={angebot?.abholung ?? true} className="h-4 w-4 accent-brand-red" /> Abholung möglich
        </label>
        <label className="flex min-h-10 items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
          <input type="checkbox" name="versand" defaultChecked={angebot?.versand} className="h-4 w-4 accent-brand-red" /> Versand möglich
        </label>
        {art === "verkaufen" && (
          <label className="flex min-h-10 items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
            <input type="checkbox" name="tausch_moeglich" defaultChecked={angebot?.tausch_moeglich} className="h-4 w-4 accent-brand-red" /> Tausch auch möglich
          </label>
        )}
      </fieldset>

      {fehler && <p className="form-error">{fehler}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={speichert || laedtHoch || !kategorie}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-red px-6 text-[15px] font-bold text-white hover:bg-brand-red-deep disabled:opacity-60"
        >
          {speichert ? "Wird gespeichert …" : angebot ? "Änderungen speichern" : art === "suchen" ? "Suchanzeige veröffentlichen" : `${ART_LABEL[art]} – jetzt einstellen`}
        </button>
        <p className="text-[12px] text-brand-ink-soft">Sichtbar für alle angemeldeten TanzRaum-Nutzer. Keine Gebühren, keine Provision.</p>
      </div>
    </form>
  );
}
