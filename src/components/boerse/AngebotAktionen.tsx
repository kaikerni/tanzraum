"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Flag, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { angebotLoeschen, angebotMelden, anbieterKontaktieren, statusSetzen } from "@/app/dashboard/boerse/actions";
import { LEERES_ERGEBNIS, Meldung, SendenButton, type AktionsErgebnis } from "@/components/ui/SendenButton";
import { MELDEGRUENDE, STATUS_LABEL, type BoerseArt, type BoerseStatus } from "@/lib/boerse";

// „Anbieter kontaktieren“ -> TanzRaum-Chat (Datenbank prueft Alter, Sperren, Blockierung)
export function KontaktKnopf({ id, art, hinweis }: { id: string; art: BoerseArt; hinweis: string | null }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  if (hinweis) return <p className="rounded-xl bg-brand-gold-wash px-4 py-3 text-[13px] text-brand-ink">{hinweis}</p>;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={laeuft}
        onClick={() => starte(async () => setMeldung(await anbieterKontaktieren(id)))}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-red px-5 text-[15px] font-bold text-white shadow-sm hover:bg-brand-red-deep disabled:opacity-60"
      >
        <MessageCircle size={18} /> {laeuft ? "Chat wird geöffnet …" : art === "suchen" ? "Suchende Person kontaktieren" : art === "verkaufen" ? "Verkäufer kontaktieren" : "Anbieter kontaktieren"}
      </button>
      <p className="text-[12px] text-brand-ink-soft">Die Nachricht läuft über den TanzRaum-Chat – deine Telefonnummer und E-Mail-Adresse bleiben privat.</p>
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
    </div>
  );
}

export function MeldenFormular({ id }: { id: string }) {
  const [offen, setOffen] = useState(false);
  const [ergebnis, aktion] = useActionState(angebotMelden, LEERES_ERGEBNIS);
  if (!offen) {
    return (
      <button type="button" onClick={() => setOffen(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft hover:text-brand-red">
        <Flag size={14} /> Angebot melden
      </button>
    );
  }
  return (
    <form action={aktion} className="flex flex-col gap-2 rounded-xl border border-brand-line bg-brand-bg p-3">
      <input type="hidden" name="id" value={id} />
      <label className="field">
        <span>Grund</span>
        <select name="grund" required defaultValue="">
          <option value="" disabled>
            Bitte wählen …
          </option>
          {MELDEGRUENDE.map(([k, t]) => (
            <option key={k} value={k}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Hinweis für die Moderation (optional)</span>
        <textarea name="text" rows={2} maxLength={500} className="rounded-[var(--radius-s)] border border-brand-line px-3 py-2 text-[13.5px] font-normal text-brand-ink outline-none focus:border-brand-red" />
      </label>
      <Meldung ergebnis={ergebnis} />
      {!ergebnis.ok && (
        <div className="flex gap-2">
          <SendenButton laedtText="Wird gesendet …" variante="gefahr">
            Melden
          </SendenButton>
          <button type="button" onClick={() => setOffen(false)} className="rounded-xl px-3 text-[13px] font-semibold text-brand-ink-soft">
            Abbrechen
          </button>
        </div>
      )}
    </form>
  );
}

const EIGENE_STATUS: BoerseStatus[] = ["aktiv", "reserviert", "pausiert", "verkauft", "verschenkt", "getauscht", "beendet"];

// Eigene Angebote: Status (aktiv/reserviert/pausiert/verkauft …), bearbeiten, loeschen
export function EigeneAktionen({ id, status, zurueck = true }: { id: string; status: BoerseStatus; zurueck?: boolean }) {
  const [laeuft, starte] = useTransition();
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  if (status === "gesperrt") {
    return (
      <button
        type="button"
        disabled={laeuft}
        onClick={() => window.confirm("Angebot endgültig löschen?") && starte(async () => setMeldung(await angebotLoeschen(id, zurueck)))}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-red hover:bg-brand-bg"
      >
        <Trash2 size={15} /> Löschen
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
          Status
          <select
            defaultValue={status}
            disabled={laeuft}
            onChange={(e) => {
              const neu = e.target.value;
              starte(async () => setMeldung(await statusSetzen(id, neu)));
            }}
            className="min-h-10 rounded-xl border border-brand-line bg-white px-2 text-[13px]"
          >
            {EIGENE_STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <Link href={`/dashboard/boerse/${id}/bearbeiten`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg">
          <Pencil size={15} /> Bearbeiten
        </Link>
        <button
          type="button"
          disabled={laeuft}
          onClick={() => window.confirm("Angebot endgültig löschen? Das kann nicht rückgängig gemacht werden.") && starte(async () => setMeldung(await angebotLoeschen(id, zurueck)))}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-red hover:bg-brand-bg"
        >
          <Trash2 size={15} /> Löschen
        </button>
      </div>
      {meldung && <Meldung ergebnis={meldung} />}
    </div>
  );
}
