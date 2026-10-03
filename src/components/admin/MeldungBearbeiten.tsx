"use client";

import { useState, useTransition } from "react";
import { meldungBearbeiten } from "@/app/dashboard/admin/actions";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";

export function MeldungBearbeiten({ id, mitSpotlight, zielGesperrt }: { id: string; mitSpotlight: boolean; zielGesperrt: boolean }) {
  const [notiz, setNotiz] = useState("");
  const [entfernen, setEntfernen] = useState(false);
  const [sperren, setSperren] = useState(false);
  const [ergebnis, setErgebnis] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-brand-bg p-3">
      <textarea
        value={notiz}
        onChange={(e) => setNotiz(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Interne Notiz (optional)"
        className="rounded-lg border border-brand-line bg-white p-2 text-[13px] outline-none focus:border-brand-red"
      />
      {mitSpotlight && (
        <label className="flex items-center gap-2 text-[13px] text-brand-ink">
          <input type="checkbox" checked={entfernen} onChange={(e) => setEntfernen(e.target.checked)} className="h-4 w-4 accent-brand-red" />
          Spotlight entfernen
        </label>
      )}
      {!zielGesperrt && (
        <label className="flex items-center gap-2 text-[13px] text-brand-red">
          <input type="checkbox" checked={sperren} onChange={(e) => setSperren(e.target.checked)} className="h-4 w-4 accent-brand-red" />
          Gemeldetes Konto sperren
        </label>
      )}
      {ergebnis && <Meldung ergebnis={ergebnis} />}
      <button
        type="button"
        disabled={laeuft}
        onClick={() => {
          if (sperren && !confirm("Konto wirklich sperren? Die Person kann TanzRaum dann nicht mehr nutzen.")) return;
          starte(async () => setErgebnis(await meldungBearbeiten(id, notiz, entfernen, sperren)));
        }}
        className="min-h-10 self-start rounded-lg bg-brand-red px-4 text-[13px] font-semibold text-white disabled:opacity-60"
      >
        Als erledigt markieren
      </button>
    </div>
  );
}
