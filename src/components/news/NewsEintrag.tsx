"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCheck, Eye, Trash2 } from "lucide-react";
import { newsGelesen, newsLesestatus, newsLoeschen } from "@/app/dashboard/news/actions";
import type { News } from "@/lib/news/getNews";

function zeit(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" });
}

export function NewsEintrag({ n, zielText }: { n: News; zielText: string }) {
  const [laeuft, starte] = useTransition();
  const [status, setStatus] = useState<{ name: string; gelesenAm: string | null }[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const offenWichtig = n.wichtig && n.istEmpfaenger && !n.gelesenAm;

  return (
    <article className={`flex flex-col gap-2 rounded-2xl border bg-white p-4 ${n.wichtig ? "border-brand-red/40" : "border-brand-line"}`}>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-brand-ink-soft">
        {n.wichtig && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-0.5 font-bold text-white">
            <AlertTriangle size={12} /> Wichtig
          </span>
        )}
        <span>{n.vereinName}</span>
        <span>·</span>
        <span>{zeit(n.erstelltAm)}</span>
        {n.autor && (
          <>
            <span>·</span>
            <span>{n.autor}</span>
          </>
        )}
        {n.istEmpfaenger && !n.gelesenAm && !n.wichtig && <span className="h-2 w-2 rounded-full bg-brand-red" aria-label="neu" />}
      </div>
      <h3 className="text-[16.5px] font-bold text-brand-ink">{n.titel}</h3>
      {n.text && <p className="whitespace-pre-line text-[14px] leading-relaxed text-brand-ink">{n.text}</p>}
      {zielText && <p className="text-[12px] text-brand-ink-faint">An: {zielText}</p>}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {offenWichtig && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => starte(async () => setFehler((await newsGelesen([n.id])).error))}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-red px-3 text-[13px] font-semibold text-white hover:bg-brand-red-deep"
          >
            <CheckCheck size={15} /> Gelesen bestätigen
          </button>
        )}
        {n.darfVerwalten && n.empfaenger !== null && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              status
                ? setStatus(null)
                : starte(async () => {
                    const r = await newsLesestatus(n.id);
                    setFehler(r.error);
                    setStatus(r.liste ?? null);
                  })
            }
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink"
          >
            <Eye size={15} /> {n.gelesen} von {n.empfaenger} gelesen
          </button>
        )}
        {n.darfVerwalten && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => {
              if (confirm("Diese News wirklich löschen?")) starte(async () => setFehler((await newsLoeschen(n.id)).error));
            }}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-red"
          >
            <Trash2 size={15} /> Löschen
          </button>
        )}
      </div>
      {status && (
        <ul className="grid gap-1 rounded-xl bg-brand-bg p-3 text-[12.5px] sm:grid-cols-2">
          {status.map((s, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="text-brand-ink">{s.name}</span>
              <span className={s.gelesenAm ? "text-brand-green" : "text-brand-ink-faint"}>{s.gelesenAm ? zeit(s.gelesenAm) : "noch nicht"}</span>
            </li>
          ))}
        </ul>
      )}
      {fehler && <p className="form-error">{fehler}</p>}
    </article>
  );
}

// Normale News beim Ansehen der Seite als gelesen markieren (wichtige nur per Bestaetigung)
export function NewsAlsGelesen({ ids }: { ids: string[] }) {
  const schluessel = ids.join(",");
  useEffect(() => {
    if (schluessel) void newsGelesen(schluessel.split(","));
  }, [schluessel]);
  return null;
}
