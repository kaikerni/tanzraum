"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { vereinsgruendungAbbrechen } from "@/app/dashboard/tarif/actions";

// Noch nicht bezahlte Vereinsgruendung zuruecknehmen (es gibt noch keinen Verein – nur die Bestellung)
export function GruendungZuruecknehmen() {
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const r = await vereinsgruendungAbbrechen();
            if (r.error) setFehler(r.error);
            else router.refresh();
          })
        }
        className="inline-flex min-h-10 items-center rounded-xl px-3 text-[13px] font-semibold text-brand-ink-soft underline hover:text-brand-red disabled:opacity-50"
      >
        {laeuft ? "Einen Moment …" : "Zurücknehmen"}
      </button>
      {fehler && <p className="form-error">{fehler}</p>}
    </div>
  );
}
