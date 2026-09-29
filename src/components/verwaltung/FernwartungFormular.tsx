"use client";

import { useActionState } from "react";
import { fernwartungAnfordern } from "@/app/dashboard/vereinsverwaltung/actions";
import { LEERES_ERGEBNIS, Meldung, SendenButton } from "@/components/ui/SendenButton";

const EINGABE = "w-full rounded-lg border border-brand-line bg-white px-3 py-2.5 text-[13.5px] text-brand-ink outline-none focus:border-brand-red";
const TYPEN = ["Einrichtung", "Bereiche & Einstellungen", "Mitgliedsantrag-Formular", "Fehler / Problem", "Sonstiges"];

export function FernwartungFormular({ vereinId }: { vereinId: string }) {
  const [ergebnis, aktion] = useActionState(fernwartungAnfordern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
        Worum geht es?
        <select name="typ" className={EINGABE} defaultValue="Bereiche & Einstellungen">
          {TYPEN.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-brand-ink-soft">
        Beschreibung
        <textarea name="beschreibung" rows={3} maxLength={1000} required className={EINGABE} placeholder="Wobei soll der TanzRaum-Support helfen?" />
      </label>
      <label className="flex items-start gap-2.5 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="fernzugriff" value="ja" className="mt-0.5 h-4 w-4 accent-[#e11d2e]" />
        <span>
          Fernzugriff für 24 Stunden erlauben: Der Support darf Vereinsdaten, Bereiche und das Mitgliedsantrag-Formular ändern.
          <span className="block text-[12.5px] text-brand-ink-soft">Mitglieder, Anträge, Chats und persönliche Daten bleiben für den Support gesperrt. Jede Änderung wird protokolliert.</span>
        </span>
      </label>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton>Support anfragen</SendenButton>
      </div>
    </form>
  );
}
