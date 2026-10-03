"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { vereinswechselEntscheiden } from "@/app/dashboard/verein/actions";

export type MeinVereinswechsel = { id: string; zielVerein: string; bestaetigt: boolean; abgelehnt: boolean };

// Hinweis oben im Dashboard: Ein Verein moechte die Person aufnehmen, sie ist aber einem anderen Verein zugeordnet.
// Nur die Person selbst stimmt zu – danach entscheidet der bisherige Verein (Freigabe).
export function VereinswechselHinweis({ wechsel }: { wechsel: MeinVereinswechsel[] }) {
  const pfad = usePathname();
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  if (pfad.startsWith("/dashboard/chat") || pfad.startsWith("/dashboard/nachrichten")) return null;
  if (wechsel.length === 0 && !meldung) return null;

  const entscheiden = (id: string, annehmen: boolean) =>
    starte(async () => {
      const r = await vereinswechselEntscheiden(id, annehmen);
      setMeldung({ text: r.error ?? r.ok ?? "", fehler: !!r.error });
      if (!r.error) router.refresh();
    });

  return (
    <div className="mx-auto mb-4 flex w-full max-w-[1200px] flex-col gap-2">
      {wechsel.map((w) => (
        <div key={w.id} className="flex flex-col gap-2.5 rounded-2xl border border-brand-gold/50 bg-brand-gold-wash/60 px-4 py-3 text-[13.5px] text-brand-ink shadow-sm">
          <div className="flex items-start gap-3">
            <ArrowRightLeft size={20} className="mt-0.5 shrink-0 text-brand-gold" />
            {w.abgelehnt ? (
              <p className="min-w-0 flex-1">
                Dein bisheriger Verein hat den Wechsel zu <strong>{w.zielVerein}</strong> nicht freigegeben. Wenn du trotzdem wechseln möchtest, wende dich an den
                TanzRaum-Support – die TanzRaum-Administration kann den Wechsel auf deinen Wunsch durchführen.
              </p>
            ) : w.bestaetigt ? (
              <p className="min-w-0 flex-1">
                Du hast dem Wechsel zu <strong>{w.zielVerein}</strong> zugestimmt. Jetzt muss dein bisheriger Verein dich freigeben.
              </p>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="font-bold">{w.zielVerein} möchte dich als Mitglied aufnehmen.</p>
                <p className="text-brand-ink-soft">
                  Du bist derzeit einem anderen Verein zugeordnet. Wenn du die Anfrage annimmst, wird deine bisherige Vereinszuordnung beendet und dein
                  TanzRaum-Konto {w.zielVerein} zugeordnet. Dein Konto, Profil, Spotlights und Nachrichten bleiben erhalten.
                </p>
              </div>
            )}
          </div>
          {!w.bestaetigt && !w.abgelehnt && (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={laeuft}
                onClick={() => entscheiden(w.id, false)}
                className="min-h-10 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg disabled:opacity-50"
              >
                Ablehnen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => {
                  if (window.confirm(`Deine bisherige Vereinszuordnung endet und du wirst ${w.zielVerein} zugeordnet, sobald dein bisheriger Verein dich freigibt. Fortfahren?`))
                    entscheiden(w.id, true);
                }}
                className="min-h-10 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep disabled:opacity-50"
              >
                Verein wechseln und beitreten
              </button>
            </div>
          )}
        </div>
      ))}
      {meldung && <p className={meldung.fehler ? "form-error" : "form-success"}>{meldung.text}</p>}
    </div>
  );
}
