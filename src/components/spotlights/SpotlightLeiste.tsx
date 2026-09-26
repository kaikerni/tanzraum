"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { SpotlightPerson } from "@/lib/spotlights/typen";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";
import { SpotlightAnsicht } from "./SpotlightAnsicht";
import { SpotlightErstellen } from "./SpotlightErstellen";

export type Ich = { userId: string; name: string; avatarUrl: string | null; darfErstellen: boolean; standardSichtbarkeit: "netzwerk" | "kontakte"; nurKontakte: boolean };

function Kreis({ name, avatarUrl, ring, groesse }: { name: string; avatarUrl: string | null; ring: "neu" | "gesehen" | "keiner"; groesse: number }) {
  const rahmen =
    ring === "neu" ? "bg-[conic-gradient(from_200deg,#e11d2e,#c9921f,#e11d2e)] p-[3px]" : ring === "gesehen" ? "bg-brand-line p-[3px]" : "p-[3px]";
  return (
    <span className={`block rounded-full ${rahmen}`} style={{ width: groesse, height: groesse }}>
      <span className="block h-full w-full rounded-full bg-white p-[2px]">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          <span className={`flex h-full w-full items-center justify-center rounded-full text-[16px] font-bold text-white ${farbeFuer(name)}`}>{initialen(name)}</span>
        )}
      </span>
    </span>
  );
}

// Spotlight-Leiste: ausschliesslich Personen (Profilbild + persoenlicher Name)
export function SpotlightLeiste({ personen, ich, gross = false }: { personen: SpotlightPerson[]; ich: Ich; gross?: boolean }) {
  const router = useRouter();
  const [ansicht, setAnsicht] = useState<number | null>(null);
  const [erstellen, setErstellen] = useState(false);
  const eigene = personen.find((p) => p.ich);
  const andere = personen.filter((p) => !p.ich);
  const reihenfolge = [...(eigene ? [eigene] : []), ...andere];
  const groesse = gross ? 72 : 62;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1" role="list" aria-label="Spotlights">
        {ich.darfErstellen && (
          <div role="listitem" className="flex w-[76px] shrink-0 flex-col items-center gap-1">
            <div className="relative">
              <button type="button" onClick={() => (eigene ? setAnsicht(0) : setErstellen(true))} aria-label={eigene ? "Deine Spotlights ansehen" : "Spotlight erstellen"}>
                <Kreis name={ich.name} avatarUrl={ich.avatarUrl} ring={eigene ? "gesehen" : "keiner"} groesse={groesse} />
              </button>
              <button
                type="button"
                onClick={() => setErstellen(true)}
                aria-label="Neues Spotlight"
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-red text-white"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
            <span className="w-full truncate text-center text-[11.5px] font-semibold text-brand-ink">+ Spotlight</span>
          </div>
        )}
        {andere.map((p) => (
          <div key={p.userId} role="listitem" className="flex w-[76px] shrink-0 flex-col items-center gap-1">
            <button type="button" onClick={() => setAnsicht(reihenfolge.indexOf(p))} aria-label={`Spotlights von ${p.name}${p.ungesehen ? " (neu)" : ""}`}>
              <Kreis name={p.name} avatarUrl={p.avatarUrl} ring={p.ungesehen > 0 ? "neu" : "gesehen"} groesse={groesse} />
            </button>
            <span className="w-full truncate text-center text-[11.5px] text-brand-ink">{p.name.split(" ")[0]}</span>
          </div>
        ))}
        {andere.length === 0 && (
          <p className="self-center text-[13px] text-brand-ink-soft">
            {ich.darfErstellen ? "Gerade teilt niemand ein Spotlight. Sei die/der Erste!" : "Gerade teilt niemand ein Spotlight."}
          </p>
        )}
      </div>

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
