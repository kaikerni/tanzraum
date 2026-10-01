"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { HINTERGRUENDE, type SpotlightPerson } from "@/lib/spotlights/typen";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";
import { SpotlightAnsicht } from "./SpotlightAnsicht";
import { SpotlightErstellen } from "./SpotlightErstellen";

export type Ich = { userId: string; name: string; avatarUrl: string | null; darfErstellen: boolean; standardSichtbarkeit: "netzwerk" | "kontakte"; nurKontakte: boolean };

// TanzRaum-Story-Kachel: leicht abgerundetes Hochformat mit eigenem Spotlight-Rahmen (Schwarz/Rot/Gold) –
// bewusst keine runden Story-Kreise. Neue Spotlights: Rahmen leuchtet dezent, ✨-Marke.
export function SpotlightKachel({
  name,
  bildUrl,
  hintergrund,
  neu,
  onClick,
  label,
  plus = false,
}: {
  name: string;
  bildUrl: string | null;
  hintergrund?: string | null;
  neu: boolean;
  onClick: () => void;
  label: string;
  plus?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="group flex w-full flex-col gap-1.5 text-left">
      <span className={`spotlight-kachel ${neu ? "spotlight-kachel-neu" : ""} block w-full`}>
        <span
          className="relative block aspect-[3/4] w-full overflow-hidden rounded-[14px] bg-brand-navy"
          style={!bildUrl && hintergrund ? { background: HINTERGRUENDE[hintergrund] ?? HINTERGRUENDE.rot } : undefined}
        >
          {bildUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bildUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
          ) : (
            <span className={`flex h-full w-full items-center justify-center text-[26px] font-extrabold text-white ${hintergrund ? "" : farbeFuer(name)}`}>
              {plus ? <Sparkles size={34} className="text-[#f2d58c]" /> : initialen(name)}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          {neu && (
            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-black/55 text-[#f2d58c] backdrop-blur" aria-hidden>
              <Sparkles size={14} />
            </span>
          )}
          {plus && (
            <span className="absolute bottom-2 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-xl border-2 border-white bg-brand-red text-white shadow-lg">
              <Plus size={18} strokeWidth={3} />
            </span>
          )}
        </span>
      </span>
      <span className="w-full truncate px-0.5 text-center text-[12.5px] font-semibold text-brand-ink">{name}</span>
    </button>
  );
}

// Spotlight-Uebersicht: Story-Kacheln (eigene + alle sichtbaren). raster = Gitter auf der Spotlight-Seite, sonst Reihe.
export function SpotlightLeiste({ personen, ich, raster = false }: { personen: SpotlightPerson[]; ich: Ich; raster?: boolean; gross?: boolean }) {
  const router = useRouter();
  const [ansicht, setAnsicht] = useState<number | null>(null);
  const [erstellen, setErstellen] = useState(false);
  const eigene = personen.find((p) => p.ich);
  const andere = personen.filter((p) => !p.ich);
  const reihenfolge = [...(eigene ? [eigene] : []), ...andere];
  const zelle = raster ? "" : "w-[104px] shrink-0 sm:w-[118px]";

  return (
    <>
      <div
        className={raster ? "grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" : "flex gap-3 overflow-x-auto pb-1"}
        role="list"
        aria-label="Spotlights"
      >
        {ich.darfErstellen && (
          <div role="listitem" className={zelle}>
            <SpotlightKachel
              name="Neue Story"
              bildUrl={ich.avatarUrl}
              hintergrund="navy"
              neu={false}
              plus
              label="Spotlight erstellen"
              onClick={() => setErstellen(true)}
            />
          </div>
        )}
        {eigene && (
          <div role="listitem" className={zelle}>
            <SpotlightKachel
              name="Deine Story"
              bildUrl={eigene.vorschauUrl ?? eigene.avatarUrl}
              hintergrund={eigene.vorschauHintergrund}
              neu={false}
              label="Deine Spotlights ansehen"
              onClick={() => setAnsicht(0)}
            />
          </div>
        )}
        {andere.map((p) => (
          <div key={p.userId} role="listitem" className={zelle}>
            <SpotlightKachel
              name={p.name.split(" ")[0]}
              bildUrl={p.vorschauUrl ?? p.avatarUrl}
              hintergrund={p.vorschauHintergrund}
              neu={p.ungesehen > 0}
              label={`Spotlights von ${p.name}${p.ungesehen ? " (neu)" : ""}`}
              onClick={() => setAnsicht(reihenfolge.indexOf(p))}
            />
          </div>
        ))}
      </div>
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
