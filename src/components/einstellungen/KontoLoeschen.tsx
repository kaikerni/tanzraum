"use client";

import { useActionState, useState } from "react";
import { kontoLoeschenBeantragen } from "@/app/dashboard/einstellungen/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export function KontoLoeschen({ hindernisse }: { hindernisse: { grund: string; text: string }[] }) {
  const [offen, setOffen] = useState(false);
  const [ergebnis, aktion] = useActionState(kontoLoeschenBeantragen, LEERES_ERGEBNIS);

  if (hindernisse.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13.5px] text-brand-ink">Dein Konto kann gerade nicht gelöscht werden:</p>
        <ul className="flex flex-col gap-1.5 text-[13px] text-brand-ink-soft">
          {hindernisse.map((h) => (
            <li key={h.grund} className="rounded-lg bg-brand-amber-wash px-3 py-2">
              {h.text}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="inline-flex min-h-10 items-center self-start rounded-xl border border-brand-red/40 bg-white px-4 text-[13.5px] font-semibold text-brand-red hover:bg-brand-red-wash"
      >
        Konto löschen …
      </button>
    );
  }
  return (
    <form action={aktion} className="flex flex-col gap-3 rounded-xl border border-brand-red/30 bg-brand-red-wash/40 p-3">
      <ul className="text-[13px] leading-relaxed text-brand-ink">
        <li>Dein Konto wird sofort gesperrt und nach 14 Tagen endgültig gelöscht.</li>
        <li>Bis dahin kannst du die Löschung über den Link in der Bestätigungs-E-Mail widerrufen.</li>
        <li>Chatnachrichten an andere bleiben erhalten, der Absender wird als „Gelöschtes Konto“ angezeigt.</li>
        <li>Rechnungen bleiben wegen der gesetzlichen Aufbewahrungspflicht erhalten.</li>
      </ul>
      <label className="field">
        <span>Passwort</span>
        <input type="password" name="passwort" autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>Zur Bestätigung LÖSCHEN eintippen</span>
        <input name="bestaetigung" autoComplete="off" required pattern="LÖSCHEN" />
      </label>
      <Meldung ergebnis={ergebnis} />
      <div className="flex flex-wrap gap-2">
        <SendenButton laedtText="Wird beantragt …">Konto endgültig löschen</SendenButton>
        <button type="button" onClick={() => setOffen(false)} className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          Abbrechen
        </button>
      </div>
    </form>
  );
}
