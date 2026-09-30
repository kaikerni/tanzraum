import Link from "next/link";
import { ImageOff, MapPin, Truck } from "lucide-react";
import { ART_LABEL, ART_STIL, STATUS_LABEL, ZUSTAND_LABEL, preisText, seitText, type Angebot } from "@/lib/boerse";
import { FavoritKnopf } from "./FavoritKnopf";

// Karte in Ergebnisliste, Favoriten und „Meine Börse“: grosses Bild, Art, Preis, Groesse/Zustand, Ort
export function AngebotKarte({ a, bild, kategorie, zusatz }: { a: Angebot; bild?: string; kategorie?: string; zusatz?: React.ReactNode }) {
  const inaktiv = a.status !== "aktiv" && a.status !== "reserviert";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)] transition-shadow hover:shadow-lg">
      <Link href={`/dashboard/boerse/${a.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-brand-bg">
          {bild ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bild} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${inaktiv ? "opacity-60 grayscale" : ""}`} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-brand-ink-faint">
              <ImageOff size={28} />
              <span className="text-[12px]">{a.art === "suchen" ? "Suchanzeige" : "Kein Bild"}</span>
            </div>
          )}
          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11.5px] font-bold shadow-sm ${ART_STIL[a.art]}`}>{ART_LABEL[a.art]}</span>
          {a.status !== "aktiv" && (
            <span className="absolute bottom-3 left-3 rounded-full bg-brand-ink/85 px-2.5 py-1 text-[11.5px] font-bold text-white">{STATUS_LABEL[a.status]}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3.5">
          <p className="text-[17px] font-extrabold leading-tight text-brand-ink">{preisText(a)}</p>
          <h3 className="line-clamp-2 break-words text-[14px] font-semibold leading-snug text-brand-ink">{a.titel}</h3>
          <p className="line-clamp-1 text-[12.5px] text-brand-ink-soft">
            {[kategorie, a.groesse ? `Gr. ${a.groesse}` : null, a.zustand ? ZUSTAND_LABEL[a.zustand] : null].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[12px] text-brand-ink-soft">
            <span className="flex min-w-0 items-center gap-1">
              {a.ort && (
                <>
                  <MapPin size={13} className="shrink-0" />
                  <span className="truncate">
                    {a.ort}
                    {a.km != null ? ` · ${a.km} km` : ""}
                  </span>
                </>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {a.versand && <Truck size={13} aria-label="Versand möglich" />}
              {seitText(a.erstellt_am)}
            </span>
          </div>
        </div>
      </Link>
      {!a.ist_meins && (
        <div className="absolute right-3 top-3">
          <FavoritKnopf id={a.id} favorit={a.favorit} />
        </div>
      )}
      {zusatz}
    </article>
  );
}
