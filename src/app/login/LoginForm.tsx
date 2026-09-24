"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { bestaetigungErneutSenden, signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton({ text, laedt, klasse = "btn-primary" }: { text: string; laedt: string; klasse?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={klasse} disabled={pending}>
      {pending ? laedt : text}
    </button>
  );
}

function ErneutSenden({ email, weiter }: { email: string; weiter: string }) {
  const [state, formAction] = useActionState(bestaetigungErneutSenden, initialState);
  if (state.ok) return <p className="form-success auth-nachtrag">{state.ok}</p>;
  return (
    <form action={formAction} className="auth-form auth-nachtrag">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="weiter" value={weiter} />
      {state.error && <p className="form-error">{state.error}</p>}
      <SubmitButton text="Bestätigungs-E-Mail erneut senden" laedt="Wird gesendet…" klasse="btn-secondary" />
    </form>
  );
}

export function LoginForm({ weiter }: { weiter: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <>
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

        <p className="auth-vergessen">
          <Link href="/passwort-vergessen">Passwort vergessen?</Link>
        </p>

        {state.error && <p className="form-error">{state.error}</p>}

        <SubmitButton text="Anmelden" laedt="Anmelden…" />
      </form>
      {state.unbestaetigt && <ErneutSenden email={state.unbestaetigt} weiter={weiter} />}
    </>
  );
}
