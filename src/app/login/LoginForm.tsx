"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Anmelden…" : "Anmelden"}
    </button>
  );
}

export function LoginForm({ weiter }: { weiter: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="weiter" value={weiter} />

      <label className="field">
        <span>E-Mail</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>

      <label className="field">
        <span>Passwort</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>

      {state.error && <p className="form-error">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
