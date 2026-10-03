"use client";

import { vereinSchrittUeberspringen } from "../actions";
import { VereinslizenzErforderlich } from "@/components/verein/VereinslizenzErforderlich";

// Onboarding Schritt 2: Ein Verein entsteht nur zusammen mit der bezahlten Vereinslizenz (kein Anlegen ohne Lizenz).
export function VereinForm() {
  return (
    <div className="flex flex-col gap-5">
      <VereinslizenzErforderlich />

      <div className="flex items-center gap-3 text-[12px] text-brand-ink-soft">
        <div className="h-px flex-1 bg-brand-line" />
        oder
        <div className="h-px flex-1 bg-brand-line" />
      </div>

      <form action={vereinSchrittUeberspringen}>
        <button type="submit" className="btn-secondary w-full">
          Weiter — ich bin nur persönlich dabei oder trete später per Einladung bei
        </button>
      </form>
    </div>
  );
}
