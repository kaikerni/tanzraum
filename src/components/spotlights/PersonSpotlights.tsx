"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { SpotlightPerson } from "@/lib/spotlights/typen";
import { SpotlightAnsicht } from "./SpotlightAnsicht";

export function PersonSpotlights({ person }: { person: SpotlightPerson | null }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  if (!person) return <p className="text-[13.5px] text-brand-ink-soft">Gerade keine aktuellen Spotlights.</p>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[conic-gradient(from_200deg,#e11d2e,#c9921f,#e11d2e)] px-4 text-[14px] font-bold text-white shadow-sm"
      >
        <Sparkles size={17} /> {person.anzahl === 1 ? "1 Spotlight ansehen" : `${person.anzahl} Spotlights ansehen`}
      </button>
      {offen && (
        <SpotlightAnsicht
          personen={[person]}
          start={0}
          onSchliessen={(geaendert) => {
            setOffen(false);
            if (geaendert) router.refresh();
          }}
        />
      )}
    </>
  );
}
