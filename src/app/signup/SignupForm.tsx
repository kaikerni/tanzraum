"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUp, type SignupState } from "./actions";

const initialState: SignupState = { error: null, emailBestaetigenNoetig: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Konto wird erstellt…" : "Konto erstellen"}
    </button>
  );
}

export function SignupForm({ weiter }: { weiter: string }) {
  const [state, formAction] = useActionState(signUp, initialState);

  if (state.emailBestaetigenNoetig) {
    return (
      <p className="form-success">
        Fast geschafft! Wir haben dir eine E-Mail von TanzRaum
        (noreply@tanzraum.app) geschickt. Bitte klicke auf „E-Mail-Adresse
        bestätigen“, um dein Konto zu aktivieren. Keine E-Mail da? Schau auch im
        Spam-Ordner nach.
      </p>
    );
  }

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="weiter" value={weiter} />
      <div className="field-row">
        <label className="field">
          <span>Vorname</span>
          <input type="text" name="vorname" autoComplete="given-name" required />
        </label>
        <label className="field">
          <span>Nachname</span>
          <input type="text" name="nachname" autoComplete="family-name" required />
        </label>
      </div>

      <label className="field">
        <span>Handle (optional)</span>
        <input type="text" name="handle" placeholder="z. B. kai.kern" />
      </label>

      <label className="field">
        <span>Geschlecht (optional)</span>
        <select name="gender" defaultValue="">
          <option value="">Keine Angabe</option>
          <option value="weiblich">weiblich</option>
          <option value="männlich">männlich</option>
          <option value="divers">divers</option>
        </select>
      </label>

      <label className="field">
        <span>E-Mail</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>

      <label className="field">
        <span>Passwort</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      {state.error && <p className="form-error">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}
