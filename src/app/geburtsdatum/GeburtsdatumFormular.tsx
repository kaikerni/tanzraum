"use client";

import { useActionState } from "react";
import { geburtsdatumSpeichern } from "./actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export function GeburtsdatumFormular() {
  const [ergebnis, aktion] = useActionState(geburtsdatumSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="auth-form">
      <label className="field">
        <span>Geburtsdatum</span>
        <input type="date" name="geburtsdatum" autoComplete="bday" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} required />
      </label>
      <label className="flex items-start gap-2 text-[13px] text-brand-ink-soft">
        <input type="checkbox" name="bestaetigt" value="ja" required className="mt-0.5 h-4 w-4 accent-brand-red" />
        Mein Geburtsdatum stimmt. Mir ist klar, dass ich es danach nicht mehr selbst ändern kann.
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gespeichert …">Speichern und weiter</SendenButton>
    </form>
  );
}
