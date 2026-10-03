"use client";

import { useActionState } from "react";
import { zustimmungAnfordern } from "./actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export function KinderkontoFormular() {
  const [ergebnis, aktion] = useActionState(zustimmungAnfordern, LEERES_ERGEBNIS);
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
        <span>E-Mail-Adresse eines Elternteils</span>
        <input type="email" name="eltern_email" autoComplete="off" required />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gesendet …">Zustimmung anfragen</SendenButton>
    </form>
  );
}
