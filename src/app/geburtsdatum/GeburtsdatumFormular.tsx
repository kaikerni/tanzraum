"use client";

import { useActionState, useState } from "react";
import { geburtsdatumSpeichern } from "./actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import { istKinderkontoAlter } from "@/lib/auth/alter";

export function GeburtsdatumFormular() {
  const [ergebnis, aktion] = useActionState(geburtsdatumSpeichern, LEERES_ERGEBNIS);
  const [kind, setKind] = useState(false);
  if (ergebnis.ok) {
    return (
      <div className="flex flex-col gap-2">
        <p className="form-success">{ergebnis.ok}</p>
        {ergebnis.error && <p className="form-error">{ergebnis.error}</p>}
      </div>
    );
  }
  return (
    <form action={aktion} className="auth-form">
      <label className="field">
        <span>Geburtsdatum</span>
        <input
          type="date"
          name="geburtsdatum"
          autoComplete="bday"
          min="1900-01-01"
          max={new Date().toISOString().slice(0, 10)}
          required
          onChange={(e) => setKind(istKinderkontoAlter(e.target.value))}
        />
      </label>
      {kind && (
        <div className="flex flex-col gap-2 rounded-xl border border-brand-line bg-brand-bg p-3">
          <p className="text-[13px] text-brand-ink">
            <strong>Du bist unter 16.</strong> Dann braucht dein Konto die Zustimmung eines Elternteils. Deine Eltern bekommen eine
            E-Mail; bis zur Zustimmung ist dein Konto gesperrt.
          </p>
          <label className="field">
            <span>E-Mail-Adresse eines Elternteils</span>
            <input type="email" name="eltern_email" autoComplete="off" required />
          </label>
        </div>
      )}
      <label className="flex items-start gap-2 text-[13px] text-brand-ink-soft">
        <input type="checkbox" name="bestaetigt" value="ja" required className="mt-0.5 h-4 w-4 accent-brand-red" />
        Mein Geburtsdatum stimmt. Mir ist klar, dass ich es danach nicht mehr selbst ändern kann.
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gespeichert …">Speichern und weiter</SendenButton>
    </form>
  );
}
