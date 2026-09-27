"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { rechtstexteBestaetigen } from "./actions";

function Knopf() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Einen Moment …" : "Bestätigen und weiter"}
    </button>
  );
}

export function RechtstexteFormular() {
  const [state, aktion] = useActionState(rechtstexteBestaetigen, { error: null });
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-[13.5px] leading-snug text-brand-ink">
        <input type="checkbox" name="rechtstexte" required className="mt-0.5" />
        <span>
          Ich akzeptiere die{" "}
          <a href="/nutzungsbedingungen" target="_blank" rel="noopener" className="font-semibold text-brand-red underline">
            Nutzungsbedingungen
          </a>{" "}
          und habe die{" "}
          <a href="/datenschutz" target="_blank" rel="noopener" className="font-semibold text-brand-red underline">
            Datenschutzerklärung
          </a>{" "}
          zur Kenntnis genommen.
        </span>
      </label>
      {state.error && <p className="form-error">{state.error}</p>}
      <Knopf />
    </form>
  );
}
