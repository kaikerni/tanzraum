"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { wissenLoeschen, wissenVeroeffentlichen } from "@/app/dashboard/treff/wissen/actions";

export function WissenAktionen({ id, status, rechte }: { id: string; status: string; rechte: { bearbeiten: boolean; veroeffentlichen: boolean; loeschen: boolean } }) {
  const router = useRouter();
  const [frage, setFrage] = useState(false);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const K = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-[13.5px] font-semibold disabled:opacity-60";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {rechte.veroeffentlichen && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const r = await wissenVeroeffentlichen(id, status !== "veroeffentlicht");
                setMeldung(r);
                if (!r.error) router.refresh();
              })
            }
            className={`${K} ${status === "veroeffentlicht" ? "border-brand-line" : "border-brand-green bg-brand-green-wash text-brand-green"}`}
          >
            {status === "veroeffentlicht" ? <EyeOff size={15} /> : <Eye size={15} />} {status === "veroeffentlicht" ? "Zurückziehen" : "Veröffentlichen"}
          </button>
        )}
        {rechte.bearbeiten && (
          <Link href={`/dashboard/treff/wissen/${id}/bearbeiten`} className={`${K} border-brand-line`}>
            <Pencil size={15} /> Bearbeiten
          </Link>
        )}
        {rechte.loeschen && (
          <button type="button" onClick={() => setFrage(true)} className={`${K} border-brand-red/40 text-brand-red`}>
            <Trash2 size={15} /> Löschen
          </button>
        )}
      </div>
      {meldung && <Meldung ergebnis={meldung} />}
      {frage && (
        <Dialog
          titel="Wissensbeitrag löschen?"
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
                    const r = await wissenLoeschen(id);
                    setMeldung(r);
                    setFrage(false);
                    if (!r.error) router.push("/dashboard/treff/wissen");
                  })
                }
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60"
              >
                Löschen
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-brand-ink">Der Beitrag wird endgültig gelöscht. Die ursprüngliche Treff-Diskussion bleibt erhalten.</p>
        </Dialog>
      )}
    </div>
  );
}
