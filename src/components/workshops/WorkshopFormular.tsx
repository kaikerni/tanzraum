"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Send, Save, Trash2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { speicherVorpruefung } from "@/lib/speicher";
import { bildVerkleinern } from "@/lib/medien/bild";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { BUNDESLAENDER, WORKSHOP_KATEGORIEN, type Workshop } from "@/lib/workshops/workshops";
import { workshopBearbeiten, workshopEinreichen, type WorkshopEingabe } from "@/app/dashboard/workshops/actions";

const leer: WorkshopEingabe = {
  titel: "",
  datum: "",
  datum_bis: "",
  uhrzeit_von: "",
  uhrzeit_bis: "",
  ausrichter: "",
  ort: "",
  adresse: "",
  bundesland: "",
  kategorie: "",
  beschreibung: "",
  ansprechpartner: "",
  kontakt: "",
  link: "",
  bild_pfad: null,
};

const FELD = "rounded-xl border border-brand-line bg-white px-3 py-2.5 text-[14.5px] font-normal text-brand-ink outline-none focus:border-brand-red";

// Workshop einreichen bzw. bearbeiten. Nach dem Absenden: EINGEREICHT (nicht sofort oeffentlich).
export function WorkshopFormular({
  userId,
  workshop,
  bildUrl,
  direktMoeglich = false,
}: {
  userId: string;
  workshop?: Workshop | null;
  bildUrl?: string | null;
  // Team mit „Erstellen“ + „Freigeben“: direkt veroeffentlichen
  direktMoeglich?: boolean;
}) {
  const router = useRouter();
  const [w, setW] = useState<WorkshopEingabe>(() =>
    workshop
      ? {
          titel: workshop.titel,
          datum: workshop.datum,
          datum_bis: workshop.datum_bis ?? "",
          uhrzeit_von: workshop.uhrzeit_von?.slice(0, 5) ?? "",
          uhrzeit_bis: workshop.uhrzeit_bis?.slice(0, 5) ?? "",
          ausrichter: workshop.ausrichter,
          ort: workshop.ort,
          adresse: workshop.adresse ?? "",
          bundesland: workshop.bundesland,
          kategorie: workshop.kategorie ?? "",
          beschreibung: workshop.beschreibung,
          ansprechpartner: workshop.ansprechpartner ?? "",
          kontakt: workshop.kontakt ?? "",
          link: workshop.link ?? "",
          bild_pfad: workshop.bild_pfad,
        }
      : leer,
  );
  const [vorschau, setVorschau] = useState<string | null>(bildUrl ?? null);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [hochladen, setHochladen] = useState(false);
  const [laeuft, starte] = useTransition();
  const datei = useRef<HTMLInputElement>(null);
  const set = (k: keyof WorkshopEingabe) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setW({ ...w, [k]: e.target.value });

  async function bildWaehlen(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setMeldung({ error: "Bitte ein Bild (JPG, PNG, WebP) auswählen." });
    setHochladen(true);
    try {
      const blob = await bildVerkleinern(f, 1600);
      const pfad = `${userId}/${crypto.randomUUID()}.jpg`;
      const speicher = await speicherVorpruefung(createClient(), "workshops", pfad, blob.size);
      if (speicher) return setMeldung({ error: speicher });
      const { error } = await createClient().storage.from("workshops").upload(pfad, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setW((alt) => ({ ...alt, bild_pfad: pfad }));
      setVorschau(URL.createObjectURL(blob));
    } catch {
      setMeldung({ error: "Das Bild konnte nicht hochgeladen werden." });
    } finally {
      setHochladen(false);
    }
  }

  function absenden(art: "einreichen" | "entwurf" | "direkt") {
    starte(async () => {
      const r = workshop ? await workshopBearbeiten(workshop.id, w, art === "entwurf") : await workshopEinreichen(w, art === "entwurf", art === "direkt");
      setMeldung(r);
      if (!r.error && r.id) router.push(`/dashboard/workshops/${r.id}?gespeichert=${art}`);
    });
  }

  const teamBearbeitung = !!workshop && workshop.status === "freigegeben";
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        absenden(teamBearbeitung ? "einreichen" : "einreichen");
      }}
    >
      <label className="field">
        Workshopname *
        <input required maxLength={140} value={w.titel} onChange={set("titel")} placeholder="z. B. Sprungtechnik für Tanzmariechen" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Datum *
          <input required type="date" value={w.datum} onChange={set("datum")} />
        </label>
        <label className="field">
          Bis (bei mehreren Tagen)
          <input type="date" value={w.datum_bis} min={w.datum || undefined} onChange={set("datum_bis")} />
        </label>
        <label className="field">
          Uhrzeit von
          <input type="time" value={w.uhrzeit_von} onChange={set("uhrzeit_von")} />
        </label>
        <label className="field">
          Uhrzeit bis
          <input type="time" value={w.uhrzeit_bis} onChange={set("uhrzeit_bis")} />
        </label>
      </div>
      <label className="field">
        Ausrichter *
        <input required maxLength={140} value={w.ausrichter} onChange={set("ausrichter")} placeholder="Verein, Verband oder Trainer/in" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Ort *
          <input required maxLength={140} value={w.ort} onChange={set("ort")} placeholder="z. B. Stuttgart" />
        </label>
        <label className="field">
          Bundesland *
          <select required value={w.bundesland} onChange={set("bundesland")}>
            <option value="">Bitte auswählen</option>
            {BUNDESLAENDER.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Adresse / Halle (für die Karte)
        <input maxLength={200} value={w.adresse} onChange={set("adresse")} placeholder="z. B. Sporthalle Nord, Hauptstraße 5" />
      </label>
      <label className="field">
        Kategorie
        <select value={w.kategorie} onChange={set("kategorie")}>
          <option value="">Keine Angabe</option>
          {WORKSHOP_KATEGORIEN.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Beschreibung *
        <textarea required rows={6} maxLength={5000} value={w.beschreibung} onChange={set("beschreibung")} className={FELD} placeholder="Inhalte, Zielgruppe, Kosten, Anmeldung …" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Ansprechpartner
          <input maxLength={140} value={w.ansprechpartner} onChange={set("ansprechpartner")} />
        </label>
        <label className="field">
          Kontakt (E-Mail oder Telefon)
          <input maxLength={200} value={w.kontakt} onChange={set("kontakt")} />
        </label>
      </div>
      <label className="field">
        Link (Anmeldung, Ausschreibung)
        <input type="url" maxLength={500} value={w.link} onChange={set("link")} placeholder="https://…" />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-semibold text-brand-ink-soft">Bild (optional)</span>
        {vorschau ? (
          <div className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-brand-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vorschau} alt="Vorschau" className="aspect-[16/9] w-full object-cover" />
            <button
              type="button"
              aria-label="Bild entfernen"
              onClick={() => {
                setW({ ...w, bild_pfad: null });
                setVorschau(null);
              }}
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-brand-red shadow"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <button type="button" disabled={hochladen} onClick={() => datei.current?.click()} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-dashed border-brand-line px-4 text-[13.5px] font-semibold hover:bg-brand-bg">
            <ImagePlus size={17} /> {hochladen ? "Wird hochgeladen …" : "Bild hinzufügen"}
          </button>
        )}
        <input ref={datei} type="file" accept="image/*" hidden onChange={(e) => bildWaehlen(e.target.files?.[0] ?? null)} />
      </div>

      {meldung && <Meldung ergebnis={meldung} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={laeuft || hochladen} className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5 disabled:opacity-60">
          <Send size={16} /> {teamBearbeitung ? "Änderungen speichern" : workshop ? "Speichern & einreichen" : "Workshop einreichen"}
        </button>
        {!teamBearbeitung && (
          <button type="button" disabled={laeuft || hochladen} onClick={() => absenden("entwurf")} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-line px-4 text-[14px] font-semibold disabled:opacity-60">
            <Save size={16} /> Als Entwurf speichern
          </button>
        )}
        {direktMoeglich && !workshop && (
          <button type="button" disabled={laeuft || hochladen} onClick={() => absenden("direkt")} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-brand-green px-4 text-[14px] font-semibold text-brand-green disabled:opacity-60">
            <CheckCircle2 size={16} /> Direkt veröffentlichen (Team)
          </button>
        )}
      </div>
      {!teamBearbeitung && (
        <p className="text-[12.5px] text-brand-ink-soft">
          Eingereichte Workshops werden vom TanzRaum-Team geprüft und erst nach der Freigabe angezeigt – nur für angemeldete TanzRaum-Nutzer. Du wirst über die
          Entscheidung benachrichtigt.
        </p>
      )}
    </form>
  );
}
