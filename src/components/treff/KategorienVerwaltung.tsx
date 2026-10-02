"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { kategorieLoeschen, kategorienSortieren, kategorieSpeichern } from "@/app/dashboard/treff/actions";
import type { Kategorie } from "@/lib/treff/treff";

// Nur TanzRaum-Admin: Kategorien erstellen, bearbeiten, sortieren, deaktivieren, loeschen
export function KategorienVerwaltung({ kategorien }: { kategorien: Kategorie[] }) {
  const router = useRouter();
  const [liste, setListe] = useState(kategorien);
  const [neu, setNeu] = useState({ name: "", emoji: "", beschreibung: "" });
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const tun = (f: () => Promise<AktionsErgebnis>) =>
    starte(async () => {
      const r = await f();
      setMeldung(r);
      if (!r.error) router.refresh();
    });
  const verschieben = (i: number, j: number) => {
    if (j < 0 || j >= liste.length) return;
    const n = [...liste];
    const [x] = n.splice(i, 1);
    n.splice(j, 0, x);
    setListe(n);
  };
  const aendern = (id: string, teil: Partial<Kategorie>) => setListe((l) => l.map((k) => (k.id === id ? { ...k, ...teil } : k)));
  const geaendert = JSON.stringify(liste.map((k) => k.id)) !== JSON.stringify(kategorien.map((k) => k.id));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {liste.map((k, i) => (
          <li key={k.id} className={`flex flex-col gap-2 rounded-2xl border p-3 ${k.aktiv ? "border-brand-line bg-white" : "border-dashed border-brand-line bg-brand-bg"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input value={k.emoji ?? ""} maxLength={8} onChange={(e) => aendern(k.id, { emoji: e.target.value })} className="w-14 rounded-lg border border-brand-line px-2 py-2 text-center text-[18px]" aria-label="Emoji" />
              <input value={k.name} maxLength={60} onChange={(e) => aendern(k.id, { name: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-brand-line px-3 py-2 text-[14.5px] font-semibold" aria-label="Name" />
              <button type="button" aria-label={`${k.name} nach oben`} disabled={i === 0} onClick={() => verschieben(i, i - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-brand-bg disabled:opacity-30">
                <ChevronUp size={17} />
              </button>
              <button type="button" aria-label={`${k.name} nach unten`} disabled={i === liste.length - 1} onClick={() => verschieben(i, i + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-brand-bg disabled:opacity-30">
                <ChevronDown size={17} />
              </button>
            </div>
            <input value={k.beschreibung ?? ""} maxLength={200} onChange={(e) => aendern(k.id, { beschreibung: e.target.value })} placeholder="Kurzbeschreibung" className="rounded-lg border border-brand-line px-3 py-2 text-[13.5px]" aria-label="Beschreibung" />
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={k.aktiv} onChange={(e) => aendern(k.id, { aktiv: e.target.checked })} className="accent-[#e11d2e]" /> aktiv
              </label>
              <span className="text-brand-ink-soft">· {k.themen} Themen</span>
              <button type="button" disabled={laeuft} onClick={() => tun(() => kategorieSpeichern(k.id, k.name, k.emoji ?? "", k.beschreibung ?? "", k.aktiv))} className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-line px-3 font-semibold">
                <Save size={14} /> Speichern
              </button>
              <button type="button" disabled={laeuft || k.themen > 0} title={k.themen > 0 ? "Enthält Themen – zuerst verschieben oder deaktivieren" : "Löschen"} onClick={() => tun(() => kategorieLoeschen(k.id))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-red/40 px-3 font-semibold text-brand-red disabled:opacity-40">
                <Trash2 size={14} /> Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
      {geaendert && (
        <button type="button" disabled={laeuft} onClick={() => tun(() => kategorienSortieren(liste.map((k) => k.id)))} className="btn-primary mt-0 inline-flex min-h-11 w-fit items-center gap-1.5">
          <Save size={16} /> Reihenfolge speichern
        </button>
      )}
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-brand-line p-3">
        <p className="text-[14px] font-bold text-brand-ink">Neue Kategorie</p>
        <div className="flex flex-wrap gap-2">
          <input value={neu.emoji} maxLength={8} onChange={(e) => setNeu({ ...neu, emoji: e.target.value })} placeholder="🎉" className="w-14 rounded-lg border border-brand-line px-2 py-2 text-center text-[18px]" aria-label="Emoji der neuen Kategorie" />
          <input value={neu.name} maxLength={60} onChange={(e) => setNeu({ ...neu, name: e.target.value })} placeholder="Name" className="min-w-0 flex-1 rounded-lg border border-brand-line px-3 py-2 text-[14.5px]" aria-label="Name der neuen Kategorie" />
        </div>
        <input value={neu.beschreibung} maxLength={200} onChange={(e) => setNeu({ ...neu, beschreibung: e.target.value })} placeholder="Kurzbeschreibung" className="rounded-lg border border-brand-line px-3 py-2 text-[13.5px]" aria-label="Beschreibung der neuen Kategorie" />
        <button
          type="button"
          disabled={laeuft || neu.name.trim().length < 2}
          onClick={() =>
            starte(async () => {
              const r = await kategorieSpeichern(null, neu.name, neu.emoji, neu.beschreibung, true);
              setMeldung(r);
              if (!r.error) {
                setNeu({ name: "", emoji: "", beschreibung: "" });
                router.refresh();
              }
            })
          }
          className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white disabled:opacity-50"
        >
          <Plus size={15} /> Kategorie anlegen
        </button>
      </div>
      {meldung && <Meldung ergebnis={meldung} />}
    </div>
  );
}
