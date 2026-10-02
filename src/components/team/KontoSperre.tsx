"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { kontoSperren } from "@/app/dashboard/team/actions";

// Konto sperren / entsperren mit Rueckfrage (Team mit „nutzer.sperren“ bzw. TanzRaum-Admin)
export function KontoSperre({ userId, handle, gesperrt }: { userId: string; handle: string; gesperrt: boolean }) {
  const router = useRouter();
  const [frage, setFrage] = useState(false);
  const [grund, setGrund] = useState("");
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setFrage(true)}
        className={`min-h-9 rounded-lg border px-3 text-[12.5px] font-semibold ${gesperrt ? "border-brand-line hover:bg-brand-bg" : "border-brand-red/40 text-brand-red hover:bg-brand-red-wash"}`}
      >
        {gesperrt ? "Entsperren" : "Sperren"}
      </button>
      {meldung && <Meldung ergebnis={meldung} />}
      {frage && (
        <Dialog
          titel={gesperrt ? `@${handle} entsperren?` : `@${handle} sperren?`}
          onSchliessen={() => setFrage(false)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFrage(false)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() =>
                  starte(async () => {
                    const r = await kontoSperren(userId, !gesperrt, grund);
                    setMeldung(r);
                    setFrage(false);
                    if (!r.error) router.refresh();
                  })
                }
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {gesperrt ? "Entsperren" : "Sperren"}
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-brand-ink">
            {gesperrt
              ? "Die Person kann sich danach wieder anmelden."
              : "Die Person kann sich nicht mehr anmelden und nichts mehr schreiben. Inhalte und Konto bleiben erhalten; die Sperre wird protokolliert."}
          </p>
          <label className="field mt-3">
            Grund (für das Protokoll)
            <input value={grund} maxLength={500} onChange={(e) => setGrund(e.target.value)} />
          </label>
        </Dialog>
      )}
    </>
  );
}
