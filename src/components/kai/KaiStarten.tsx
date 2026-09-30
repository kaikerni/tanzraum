"use client";

import { Wrench } from "lucide-react";
import { kaiOeffnen, type KaiModus } from "@/lib/kai/steuerung";

// Knopf, der Kai (Begleiter in der Kopfzeile) von einer beliebigen Seite aus oeffnet – z. B. direkt in der Einrichtung
export function KaiStarten({ modus = "einrichtung", children = "Einrichtung mit Kai starten" }: { modus?: KaiModus; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => kaiOeffnen(modus)}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-ink px-4 text-[13px] font-semibold text-white hover:bg-brand-navy"
    >
      <Wrench size={15} /> {children}
    </button>
  );
}
