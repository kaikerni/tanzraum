"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { passwortLinkAnfordern, type VergessenState } from "./actions";

const initialState: VergessenState = { error: null, gesendet: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Wird gesendet…" : "Link zum Zurücksetzen senden"}
    </button>
  );
}

export function VergessenFormular() {
  const [state, formAction] = useActionState(passwortLinkAnfordern, initialState);

  if (state.gesendet) {
    return (
      <p className="form-success">
        Wenn ein TanzRaum-Konto mit dieser E-Mail-Adresse besteht, haben wir dir soeben einen Link zum Zurücksetzen geschickt.
        Der Link ist aus Sicherheitsgründen nur begrenzte Zeit gültig und kann nur einmal verwendet werden. Keine E-Mail da?
        Schau auch im Spam-Ordner nach.
      </p>
    );
  }

  return (
    <form action={formAction} className="auth-form">
      <label className="field">
        <span>E-Mail</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      {state.error && <p className="form-error">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
