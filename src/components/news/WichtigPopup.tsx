"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Megaphone } from "lucide-react";
import { ankuendigungGelesen, newsGelesen } from "@/app/dashboard/news/actions";

export type PopupEintrag = {
  art: "news" | "ankuendigung";
  id: string;
  titel: string;
  text: string;
  quelle: string;
  zeit: string;
  bildUrl?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
};

// Wichtige News und wichtige TanzRaum-Ankuendigungen: erscheinen, bis sie bestaetigt sind (danach nicht erneut)
export function WichtigPopup({ eintraege }: { eintraege: PopupEintrag[] }) {
  const [index, setIndex] = useState(0);
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const router = useRouter();
  const e = eintraege[index];
  if (!e) return null;

  function bestaetigen() {
    starte(async () => {
      const r = e.art === "news" ? await newsGelesen([e.id]) : await ankuendigungGelesen([e.id]);
      if (r.error) return setFehler(r.error);
      setFehler(null);
      if (index + 1 < eintraege.length) setIndex(index + 1);
      else {
        setIndex(eintraege.length);
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="wichtig-titel">
      <div className="flex max-h-[85dvh] w-full max-w-[520px] flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-red">
          {e.art === "news" ? <AlertTriangle size={16} /> : <Megaphone size={16} />}
          {e.art === "news" ? "Wichtige Vereinsinformation" : "TanzRaum-Ankündigung"}
          {eintraege.length > 1 && (
            <span className="ml-auto text-brand-ink-soft">
              {index + 1} / {eintraege.length}
            </span>
          )}
        </div>
        <h2 id="wichtig-titel" className="text-[20px] font-extrabold text-brand-ink">
          {e.titel}
        </h2>
        <p className="text-[12.5px] text-brand-ink-soft">
          {e.quelle} · {new Date(e.zeit).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" })}
        </p>
        {e.bildUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.bildUrl} alt="" className="max-h-72 w-full rounded-xl object-contain" />
        )}
        {e.text && <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-brand-ink">{e.text}</p>}
        {e.linkUrl && (
          <a href={e.linkUrl} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold text-brand-red underline">
            {e.linkText || "Mehr erfahren"}
          </a>
        )}
        {fehler && <p className="form-error">{fehler}</p>}
        <button
          type="button"
          disabled={laeuft}
          onClick={bestaetigen}
          className="mt-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-red px-4 text-[14.5px] font-bold text-white hover:bg-brand-red-deep disabled:opacity-60"
        >
          {laeuft ? "Einen Moment …" : "Gelesen"}
        </button>
      </div>
    </div>
  );
}
