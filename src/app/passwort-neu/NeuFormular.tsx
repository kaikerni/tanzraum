"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { neuesPasswortSpeichern, type NeuState } from "./actions";

const initialState: NeuState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Wird gespeichert…" : "Passwort speichern"}
    </button>
  );
}

export function NeuFormular() {
  const [state, formAction] = useActionState(neuesPasswortSpeichern, initialState);

  return (
    <form action={formAction} className="auth-form">
      <label className="field">
        <span>Neues Passwort</span>
        <input type="password" name="passwort" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="field">
        <span>Neues Passwort wiederholen</span>
        <input type="password" name="wiederholung" autoComplete="new-password" minLength={8} required />
      </label>
      <p className="text-[12.5px] text-brand-ink-soft">Mindestens 8 Zeichen, am besten mit Zahlen und Sonderzeichen.</p>
      {state.error && <p className="form-error">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
