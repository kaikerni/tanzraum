"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bildVerkleinern } from "@/lib/medien/bild";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { wissenSpeichern, type WissenEingabe } from "@/app/dashboard/treff/wissen/actions";
import type { Kategorie } from "@/lib/treff/treff";
import type { WissenArtikel } from "@/lib/wissen";

const FELD = "rounded-xl border border-brand-line bg-white px-3 py-2.5 text-[14.5px] font-normal text-brand-ink outline-none focus:border-brand-red";

// Redaktion: Wissensbeitrag anlegen (auch aus einem Treff-Thema) oder bearbeiten – als Entwurf, veroeffentlicht wird separat
export function WissenEditor({
  userId,
  kategorien,
  artikel,
  bildUrl,
  vorlage,
}: {
  userId: string;
  kategorien: Kategorie[];
  artikel?: WissenArtikel | null;
  bildUrl?: string | null;
  vorlage?: { themaId: string; titel: string; kategorieId: string; inhalt: string } | null;
}) {
  const router = useRouter();
  const [e, setE] = useState<WissenEingabe>(() => ({
    titel: artikel?.titel ?? vorlage?.titel ?? "",
    kategorie_id: artikel?.kategorie_id ?? vorlage?.kategorieId ?? "",
    einleitung: artikel?.einleitung ?? "",
    inhalt: artikel?.inhalt ?? vorlage?.inhalt ?? "",
    link: artikel?.link ?? "",
    redaktionshinweis: artikel?.redaktionshinweis ?? (vorlage ? "Redaktionell zusammengefasst aus Beiträgen der TanzRaum-Community." : ""),
    treff_thema_id: artikel?.treff_thema_id ?? vorlage?.themaId ?? "",
    bild_pfad: artikel?.bild_pfad ?? null,
  }));
  const [vorschau, setVorschau] = useState<string | null>(bildUrl ?? null);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const datei = useRef<HTMLInputElement>(null);
  const set = (k: keyof WissenEingabe) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setE({ ...e, [k]: ev.target.value });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        starte(async () => {
          const r = await wissenSpeichern(artikel?.id ?? null, e);
          setMeldung(r);
          if (!r.error && r.id) router.push(`/dashboard/treff/wissen/${r.id}`);
        });
      }}
    >
      <label className="field">
        Titel *
        <input required minLength={5} maxLength={160} value={e.titel} onChange={set("titel")} placeholder="z. B. Sprungkrafttraining im karnevalistischen Tanzsport" />
      </label>
      <label className="field">
        Kategorie
        <select value={e.kategorie_id} onChange={set("kategorie_id")}>
          <option value="">Keine</option>
          {kategorien.map((k) => (
            <option key={k.id} value={k.id}>
              {k.emoji} {k.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Einleitung
        <textarea rows={3} maxLength={1000} value={e.einleitung} onChange={set("einleitung")} className={FELD} />
      </label>
      <label className="field">
        Inhalt *
        <textarea required rows={14} maxLength={30000} value={e.inhalt} onChange={set("inhalt")} className={FELD} />
      </label>
      <label className="field">
        Link (optional)
        <input type="url" maxLength={500} value={e.link} onChange={set("link")} placeholder="https://…" />
      </label>
      <label className="field">
        Redaktioneller Hinweis
        <input maxLength={500} value={e.redaktionshinweis} onChange={set("redaktionshinweis")} />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-semibold text-brand-ink-soft">Bild (optional)</span>
        {vorschau ? (
          <div className="relative w-fit overflow-hidden rounded-xl border border-brand-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vorschau} alt="Vorschau" className="h-32 w-56 object-cover" />
            <button
              type="button"
              aria-label="Bild entfernen"
              onClick={() => {
                setE({ ...e, bild_pfad: null });
                setVorschau(null);
              }}
              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand-red"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => datei.current?.click()} className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl border border-dashed border-brand-line px-3 text-[13px] font-semibold hover:bg-brand-bg">
            <ImagePlus size={16} /> Bild hinzufügen
          </button>
        )}
        <input
          ref={datei}
          type="file"
          accept="image/*"
          hidden
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            if (!f) return;
            const blob = await bildVerkleinern(f, 1600);
            const pfad = `${userId}/${crypto.randomUUID()}.jpg`;
            const { error } = await createClient().storage.from("wissen").upload(pfad, blob, { contentType: "image/jpeg" });
            if (error) return setMeldung({ error: "Das Bild konnte nicht hochgeladen werden." });
            setE((alt) => ({ ...alt, bild_pfad: pfad }));
            setVorschau(URL.createObjectURL(blob));
          }}
        />
      </div>
      {e.treff_thema_id && <p className="text-[12.5px] text-brand-ink-soft">Verknüpft mit der ursprünglichen Diskussion im TanzRaum Treff – das Thema bleibt erhalten.</p>}
      {meldung && <Meldung ergebnis={meldung} />}
      <div>
        <button type="submit" disabled={laeuft} className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5 disabled:opacity-60">
          <Save size={16} /> {artikel ? "Speichern" : "Als Entwurf speichern"}
        </button>
      </div>
    </form>
  );
}
