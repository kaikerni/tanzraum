"use client";

import { useActionState } from "react";
import { antragVerwaltungSpeichern } from "@/app/dashboard/mitgliedsantraege/actions";
import { LEERES_ERGEBNIS, Meldung, SendenButton } from "@/components/ui/SendenButton";

const EINGABE = "w-full rounded-lg border border-brand-line bg-white px-3 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-red";

// Nur fuer den Verein: Mitglieds-/Familiennummer, interne Notiz, Papier-Unterschrift liegt vor
export function VerwaltungsFelder({
  antragId,
  mitgliedsnummer,
  familiennummer,
  notiz,
  papierVorliegend,
  papierVerfahren,
}: {
  antragId: string;
  mitgliedsnummer: string | null;
  familiennummer: string | null;
  notiz: string | null;
  papierVorliegend: boolean;
  papierVerfahren: boolean;
}) {
  const [ergebnis, aktion] = useActionState(antragVerwaltungSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="antrag_id" value={antragId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
          Mitgliedsnummer
          <input name="mitgliedsnummer" defaultValue={mitgliedsnummer ?? ""} maxLength={40} className={EINGABE} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
          Familiennummer
          <input name="familiennummer" defaultValue={familiennummer ?? ""} maxLength={40} className={EINGABE} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
        Interne Notiz (nur für den Verein)
        <textarea name="notiz" defaultValue={notiz ?? ""} maxLength={2000} rows={2} className={EINGABE} />
      </label>
      <label className="flex items-center gap-2.5 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="papier_vorliegend" defaultChecked={papierVorliegend} className="h-4 w-4 accent-[#e11d2e]" />
        Unterschriebener Antrag auf Papier liegt vor{papierVerfahren ? "" : " (optional)"}
      </label>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton variante="sekundaer">Speichern</SendenButton>
      </div>
    </form>
  );
}
