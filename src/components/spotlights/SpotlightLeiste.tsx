"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { HINTERGRUENDE, type SpotlightPerson } from "@/lib/spotlights/typen";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";
import { SpotlightAnsicht } from "./SpotlightAnsicht";
import { SpotlightErstellen } from "./SpotlightErstellen";

export type Ich = { userId: string; name: string; avatarUrl: string | null; darfErstellen: boolean; standardSichtbarkeit: "netzwerk" | "kontakte"; nurKontakte: boolean };

// Ring um den Story-Kreis: neu = TanzRaum-Verlauf (Rot/Gold/Schwarz), gesehen = dezent grau,
// eigen = feines Gold, leer = gestrichelt (noch kein eigenes Spotlight)
export type Ring = "neu" | "gesehen" | "eigen" | "leer";

// Groesse: mobil kompakt (mehrere gleichzeitig sichtbar), Desktop deutlich groesser
const KREIS = "h-[66px] w-[66px] sm:h-[80px] sm:w-[80px] lg:h-[96px] lg:w-[96px]";
const ZELLE = "w-[80px] sm:w-[96px] lg:w-[112px]";

// Runder Story-Kreis mit Vorschau (neuestes Foto, Text-Hintergrund oder Profilbild/Initialen) und Name darunter
export function SpotlightKreis({
  name,
  bildUrl,
  hintergrund,
  ring,
  onClick,
  label,
  leer = false,
  zusatz,
}: {
  name: string;
  bildUrl: string | null;
  hintergrund?: string | null;
  ring: Ring;
  onClick: () => void;
  label: string;
  leer?: boolean;
  zusatz?: ReactNode;
}) {
  return (
    <div className={`relative flex shrink-0 snap-start flex-col items-center gap-1.5 ${ZELLE}`}>
      <button type="button" onClick={onClick} aria-label={label} className="group rounded-full focus-visible:outline-none">
        <span className={`spotlight-ring spotlight-ring-${ring} block rounded-full`}>
          <span className="block rounded-full bg-white">
            <span
              className={`relative flex ${KREIS} items-center justify-center overflow-hidden rounded-full bg-brand-navy`}
              style={!bildUrl && hintergrund ? { background: HINTERGRUENDE[hintergrund] ?? HINTERGRUENDE.rot } : leer ? { background: "#f7f4ee" } : undefined}
            >
              {leer ? (
                <Plus size={30} strokeWidth={2.6} className="text-brand-red transition-transform duration-200 group-hover:scale-110" />
              ) : bildUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bildUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" />
              ) : hintergrund ? (
                <Sparkles size={24} className="text-white/90" />
              ) : (
                <span className={`flex h-full w-full items-center justify-center text-[20px] font-extrabold text-white sm:text-[24px] ${farbeFuer(name)}`}>
                  {initialen(name)}
                </span>
              )}
            </span>
          </span>
        </span>
      </button>
      {zusatz}
      <span
        className={`spotlight-name line-clamp-2 w-full break-words text-center text-[12px] leading-tight sm:text-[12.5px] ${ring === "neu" ? "font-bold text-brand-ink" : "font-medium text-brand-ink-soft"}`}
      >
        {name}
      </span>
    </div>
  );
}

// Horizontale Story-Reihe: nur die Reihe scrollt (Wischen/Trackpad), nie die Seite. Pfeile bei weiteren Spotlights.
function StoryReihe({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mehr, setMehr] = useState({ links: false, rechts: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pruefen = () => setMehr({ links: el.scrollLeft > 4, rechts: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    pruefen();
    el.addEventListener("scroll", pruefen, { passive: true });
    const ro = new ResizeObserver(pruefen);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", pruefen);
      ro.disconnect();
    };
  }, []);
  const schieben = (richtung: 1 | -1) => ref.current?.scrollBy({ left: richtung * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const pfeil =
    "absolute top-[39px] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-brand-line bg-white/95 text-brand-ink shadow-[0_4px_14px_-6px_rgba(27,33,48,0.35)] hover:bg-white sm:top-[46px] sm:flex lg:top-[54px]";
  return (
    <div className="relative min-w-0">
      <div
        ref={ref}
        className="flex snap-x snap-proximity gap-1.5 overflow-x-auto overscroll-x-contain pb-1 pt-0.5 [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Spotlights"
      >
        {children}
      </div>
      {mehr.links && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent" />}
      {mehr.rechts && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />}
      {mehr.links && (
        <button type="button" onClick={() => schieben(-1)} aria-label="Vorherige Spotlights" className={`${pfeil} -left-1`}>
          <ChevronLeft size={18} />
        </button>
      )}
      {mehr.rechts && (
        <button type="button" onClick={() => schieben(1)} aria-label="Weitere Spotlights" className={`${pfeil} -right-1`}>
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

// Spotlight-Uebersicht als Story-Leiste: zuerst „Mein Spotlight“ (erstellen bzw. eigenes ansehen + kleiner Plus-Knopf),
// dann alle sichtbaren Spotlights. Oeffnen/Erstellen nutzen unveraendert SpotlightAnsicht/SpotlightErstellen.
export function SpotlightLeiste({ personen, ich }: { personen: SpotlightPerson[]; ich: Ich }) {
  const router = useRouter();
  const [ansicht, setAnsicht] = useState<number | null>(null);
  const [erstellen, setErstellen] = useState(false);
  const eigene = personen.find((p) => p.ich);
  const andere = personen.filter((p) => !p.ich);
  const reihenfolge = [...(eigene ? [eigene] : []), ...andere];

  return (
    <>
      <StoryReihe>
        {eigene ? (
          <div role="listitem">
            <SpotlightKreis
              name="Mein Spotlight"
              bildUrl={eigene.vorschauUrl ?? eigene.avatarUrl ?? ich.avatarUrl}
              hintergrund={eigene.vorschauHintergrund}
              ring="eigen"
              label="Mein Spotlight ansehen"
              onClick={() => setAnsicht(0)}
              zusatz={
                ich.darfErstellen ? (
                  <button
                    type="button"
                    onClick={() => setErstellen(true)}
                    aria-label="Neues Spotlight erstellen"
                    title="Neues Spotlight"
                    className="absolute right-0 top-[48px] flex h-7 w-7 items-center justify-center rounded-full border-[2.5px] border-white bg-brand-red text-white shadow-md hover:brightness-110 sm:right-1 sm:top-[62px] lg:right-1.5 lg:top-[74px] lg:h-8 lg:w-8"
                  >
                    <Plus size={16} strokeWidth={3} />
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          ich.darfErstellen && (
            <div role="listitem">
              <SpotlightKreis name="Mein Spotlight" bildUrl={null} ring="leer" leer label="Spotlight erstellen" onClick={() => setErstellen(true)} />
            </div>
          )
        )}
        {andere.map((p) => (
          <div key={p.userId} role="listitem">
            <SpotlightKreis
              name={p.name.split(" ")[0]}
              bildUrl={p.vorschauUrl ?? p.avatarUrl}
              hintergrund={p.vorschauHintergrund}
              ring={p.ungesehen > 0 ? "neu" : "gesehen"}
              label={`Spotlights von ${p.name}${p.ungesehen ? " (neu)" : ""}`}
              onClick={() => setAnsicht(reihenfolge.indexOf(p))}
            />
          </div>
        ))}
      </StoryReihe>
      {andere.length === 0 && (
        <p className="mt-2 text-[13px] text-brand-ink-soft">
          {ich.darfErstellen ? "Gerade teilt niemand ein Spotlight. Sei die/der Erste!" : "Gerade teilt niemand ein Spotlight."}
        </p>
      )}

      {ansicht !== null && reihenfolge.length > 0 && (
        <SpotlightAnsicht
          personen={reihenfolge}
          start={ansicht}
          onSchliessen={(geaendert) => {
            setAnsicht(null);
            if (geaendert) router.refresh();
          }}
        />
      )}
      {erstellen && (
        <SpotlightErstellen
          userId={ich.userId}
          standardSichtbarkeit={ich.standardSichtbarkeit}
          nurKontakte={ich.nurKontakte}
          onAbbrechen={() => setErstellen(false)}
          onFertig={() => {
            setErstellen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
