"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Lightbulb, Send, Trash2 } from "lucide-react";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { aehnlicheThemen, themaErstellen } from "@/app/dashboard/treff/actions";
import { treffHochladen } from "@/components/treff/TreffDatei";
import type { Kategorie } from "@/lib/treff/treff";

const FELD = "rounded-xl border border-brand-line bg-white px-3 py-2.5 text-[14.5px] font-normal text-brand-ink outline-none focus:border-brand-red";

// Neues Thema: Kategorie, Titel, Inhalt (Pflicht) – optional Bild, PDF, Link. Aehnliche Themen werden vorgeschlagen.
export function NeuesThema({ userId, kategorien, startKategorie }: { userId: string; kategorien: Kategorie[]; startKategorie: string | null }) {
  const router = useRouter();
  const [kategorie, setKategorie] = useState(startKategorie ?? "");
  const [titel, setTitel] = useState("");
  const [inhalt, setInhalt] = useState("");
  const [link, setLink] = useState("");
  const [bild, setBild] = useState<{ pfad: string; url: string } | null>(null);
  const [datei, setDatei] = useState<{ pfad: string; name: string } | null>(null);
  const [aehnlich, setAehnlich] = useState<{ id: string; titel: string; antworten: number; kategorie: string }[]>([]);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [hochladen, setHochladen] = useState(false);
  const [laeuft, starte] = useTransition();
  const bildInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (titel.trim().length < 5) return setAehnlich([]);
    let aktiv = true;
    const t = setTimeout(async () => {
      const r = await aehnlicheThemen(titel);
      if (aktiv) setAehnlich(r);
    }, 450);
    return () => {
      aktiv = false;
      clearTimeout(t);
    };
  }, [titel]);

  async function laden(f: File | null, art: "bild" | "pdf") {
    if (!f) return;
    setHochladen(true);
    const r = await treffHochladen(userId, f);
    setHochladen(false);
    if ("fehler" in r) return setMeldung({ error: r.fehler });
    if (art === "bild") setBild({ pfad: r.pfad, url: URL.createObjectURL(f) });
    else setDatei(r);
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        starte(async () => {
          const r = await themaErstellen({ kategorie, titel, inhalt, link, bildPfad: bild?.pfad ?? null, dateiPfad: datei?.pfad ?? null, dateiName: datei?.name ?? null });
          setMeldung(r);
          if (!r.error && r.id) router.push(`/dashboard/treff/thema/${r.id}`);
        });
      }}
    >
      <label className="field">
        Kategorie *
        <select required value={kategorie} onChange={(e) => setKategorie(e.target.value)}>
          <option value="">Bitte auswählen</option>
          {kategorien
            .filter((k) => k.aktiv)
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.emoji} {k.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        Titel *
        <input required minLength={5} maxLength={160} value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Welche Übungen helfen bei Sprungkraft?" />
      </label>
      {aehnlich.length > 0 && (
        <div className="rounded-2xl border border-brand-gold/40 bg-brand-gold-wash/50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-brand-ink">
            <Lightbulb size={15} className="text-brand-gold" /> Ähnliche Themen gibt es schon – vielleicht ist deine Frage dort beantwortet:
          </p>
          <ul className="flex flex-col gap-1">
            {aehnlich.map((a) => (
              <li key={a.id}>
                <Link href={`/dashboard/treff/thema/${a.id}`} target="_blank" className="text-[13.5px] font-semibold text-brand-red hover:underline">
                  {a.titel}
                </Link>
                <span className="text-[12px] text-brand-ink-soft">
                  {" "}
                  · {a.kategorie} · {a.antworten} Antwort{a.antworten === 1 ? "" : "en"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label className="field">
        Inhalt *
        <textarea required rows={8} maxLength={10000} value={inhalt} onChange={(e) => setInhalt(e.target.value)} className={FELD} placeholder="Beschreibe deine Frage oder dein Thema …" />
      </label>
      <label className="field">
        Link (optional)
        <input type="url" maxLength={500} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {bild ? (
          <div className="relative overflow-hidden rounded-xl border border-brand-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bild.url} alt="Bild" className="h-24 w-36 object-cover" />
            <button type="button" aria-label="Bild entfernen" onClick={() => setBild(null)} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-brand-red">
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <button type="button" disabled={hochladen} onClick={() => bildInput.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-brand-line px-3 text-[13px] font-semibold hover:bg-brand-bg">
            <ImagePlus size={16} /> Bild
          </button>
        )}
        {datei ? (
          <span className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line px-3 text-[13px]">
            <FileText size={15} className="text-brand-red" /> {datei.name}
            <button type="button" aria-label="PDF entfernen" onClick={() => setDatei(null)} className="text-brand-red">
              <Trash2 size={13} />
            </button>
          </span>
        ) : (
          <button type="button" disabled={hochladen} onClick={() => pdfInput.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-brand-line px-3 text-[13px] font-semibold hover:bg-brand-bg">
            <FileText size={16} /> PDF
          </button>
        )}
        {hochladen && <span className="text-[12.5px] text-brand-ink-soft">Wird hochgeladen …</span>}
        <input ref={bildInput} type="file" accept="image/*" hidden onChange={(e) => laden(e.target.files?.[0] ?? null, "bild")} />
        <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={(e) => laden(e.target.files?.[0] ?? null, "pdf")} />
      </div>
      {meldung && <Meldung ergebnis={meldung} />}
      <div>
        <button type="submit" disabled={laeuft || hochladen} className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5 disabled:opacity-60">
          <Send size={16} /> Thema veröffentlichen
        </button>
      </div>
      <p className="text-[12px] text-brand-ink-soft">
        Sichtbar für alle angemeldeten TanzRaum-Nutzer mit deinem @Nutzernamen, Profilbild und Verein. Bitte bleib freundlich – Inhalte können gemeldet werden.
      </p>
    </form>
  );
}
