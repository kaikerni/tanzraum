"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SpotlightPerson } from "@/lib/spotlights/typen";
import { SpotlightAnsicht } from "./SpotlightAnsicht";
import { SpotlightKachel } from "./SpotlightLeiste";

// Spotlights im Personenprofil: eine Story-Kachel
export function PersonSpotlights({ person }: { person: SpotlightPerson | null }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  if (!person) return <p className="text-[13.5px] text-brand-ink-soft">Gerade keine aktuellen Spotlights.</p>;
  return (
    <>
      <div className="w-[118px]">
        <SpotlightKachel
          name={person.anzahl === 1 ? "1 Spotlight" : `${person.anzahl} Spotlights`}
          bildUrl={person.vorschauUrl ?? person.avatarUrl}
          hintergrund={person.vorschauHintergrund}
          neu={person.ungesehen > 0}
          label={`Spotlights von ${person.name} ansehen`}
          onClick={() => setOffen(true)}
        />
      </div>
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
