"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { favoritSetzen } from "@/app/dashboard/boerse/actions";

// Herz auf Karten und Detailseite (merkt Angebote unter „Meine Favoriten“)
export function FavoritKnopf({ id, favorit, gross = false }: { id: string; favorit: boolean; gross?: boolean }) {
  const [an, setAn] = useState(favorit);
  const [laeuft, starte] = useTransition();
  const umschalten = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const neu = !an;
    setAn(neu);
    starte(async () => {
      const r = await favoritSetzen(id, neu);
      if (r.error) setAn(!neu);
    });
  };
  if (gross) {
    return (
      <button
        type="button"
        onClick={umschalten}
        disabled={laeuft}
        aria-pressed={an}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[14px] font-semibold transition-colors ${
          an ? "border-brand-red/40 bg-brand-red-wash text-brand-red" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"
        }`}
      >
        <Heart size={17} className={an ? "fill-brand-red" : ""} /> {an ? "In deinen Favoriten" : "Zu Favoriten hinzufügen"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={umschalten}
      disabled={laeuft}
      aria-pressed={an}
      aria-label={an ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-md backdrop-blur transition-transform hover:scale-105"
    >
      <Heart size={18} className={an ? "fill-brand-red text-brand-red" : ""} />
    </button>
  );
}
