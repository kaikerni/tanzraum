"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Check, Pencil, Trash2, Undo2, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Meldung, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { workshopLoeschen, workshopStatus } from "@/app/dashboard/workshops/actions";

export type WorkshopRechte = { bearbeiten: boolean; freigeben: boolean; ablehnen: boolean; archivieren: boolean; loeschen: boolean; zurueckziehen: boolean };

const KNOPF = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-[13.5px] font-semibold disabled:opacity-60";

// Aktionen am Workshop – nur angezeigt, wenn das Recht besteht; die Datenbank prueft jede Aktion erneut
export function WorkshopAktionen({ id, status, rechte }: { id: string; status: string; rechte: WorkshopRechte }) {
  const router = useRouter();
  const [ablehnen, setAblehnen] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [grund, setGrund] = useState("");
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  const tun = (f: () => Promise<AktionsErgebnis>, danach?: string) =>
    starte(async () => {
      const r = await f();
      setMeldung(r);
      setAblehnen(false);
      setLoeschen(false);
      if (!r.error) {
        if (danach) router.push(danach);
        else router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {rechte.freigeben && status !== "freigegeben" && (
          <button type="button" disabled={laeuft} onClick={() => tun(() => workshopStatus(id, "freigegeben"))} className={`${KNOPF} border-brand-green bg-brand-green-wash text-brand-green`}>
            <Check size={16} /> Freigeben
          </button>
        )}
        {rechte.ablehnen && status === "eingereicht" && (
          <button type="button" disabled={laeuft} onClick={() => setAblehnen(true)} className={`${KNOPF} border-brand-red/40 text-brand-red`}>
            <X size={16} /> Ablehnen
          </button>
        )}
        {rechte.bearbeiten && (
          <Link href={`/dashboard/workshops/${id}/bearbeiten`} className={`${KNOPF} border-brand-line`}>
            <Pencil size={15} /> Bearbeiten
          </Link>
        )}
        {rechte.zurueckziehen && (status === "eingereicht" || status === "abgelehnt") && (
          <button type="button" disabled={laeuft} onClick={() => tun(() => workshopStatus(id, "entwurf"))} className={`${KNOPF} border-brand-line`}>
            <Undo2 size={15} /> Zurückziehen
          </button>
        )}
        {rechte.archivieren && status === "freigegeben" && (
          <button type="button" disabled={laeuft} onClick={() => tun(() => workshopStatus(id, "archiviert"))} className={`${KNOPF} border-brand-line`}>
            <Archive size={15} /> Archivieren
          </button>
        )}
        {rechte.loeschen && (
          <button type="button" disabled={laeuft} onClick={() => setLoeschen(true)} className={`${KNOPF} border-brand-red/40 text-brand-red`}>
            <Trash2 size={15} /> Löschen
          </button>
        )}
      </div>
      {meldung && <Meldung ergebnis={meldung} />}

      {ablehnen && (
        <Dialog
          titel="Workshop ablehnen"
          untertitel="Die einreichende Person wird mit diesem Grund benachrichtigt."
          onSchliessen={() => setAblehnen(false)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAblehnen(false)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button
                type="button"
                disabled={laeuft || grund.trim().length < 3}
                onClick={() => tun(() => workshopStatus(id, "abgelehnt", grund))}
                className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-50"
              >
                Ablehnen
              </button>
            </div>
          }
        >
          <label className="field">
            Grund
            <input autoFocus value={grund} maxLength={1000} onChange={(e) => setGrund(e.target.value)} placeholder="z. B. Bitte Ort und Uhrzeit ergänzen" />
          </label>
        </Dialog>
      )}
      {loeschen && (
        <Dialog
          titel="Workshop endgültig löschen?"
          onSchliessen={() => setLoeschen(false)}
          fuss={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLoeschen(false)} className="min-h-11 rounded-xl border border-brand-line px-4 text-[14px] font-semibold">
                Abbrechen
              </button>
              <button type="button" disabled={laeuft} onClick={() => tun(() => workshopLoeschen(id), "/dashboard/workshops")} className="min-h-11 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white disabled:opacity-60">
                Löschen
              </button>
            </div>
          }
        >
          <p className="text-[14px] text-brand-ink">
            Der Workshop wird mit Bild endgültig gelöscht. Vergangene Workshops werden sonst nicht gelöscht, sondern unter „Vergangene Workshops“ angezeigt.
          </p>
        </Dialog>
      )}
    </div>
  );
}
