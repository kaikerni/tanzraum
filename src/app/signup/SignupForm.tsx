"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { elternMailErneut, signUp, type SignupState } from "./actions";
import { istKinderkontoAlter } from "@/lib/auth/alter";

const initialState: SignupState = { error: null, emailBestaetigenNoetig: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Konto wird erstellt…" : "Konto erstellen"}
    </button>
  );
}

function ElternWarten({ kindId, mailFehler }: { kindId?: string; mailFehler?: string | null }) {
  const [meldung, setMeldung] = useState<{ error: string | null; ok?: string } | null>(mailFehler ? { error: mailFehler } : null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <p className="form-success">
        Fast geschafft! Weil du unter 16 bist, haben wir deinen Eltern eine E-Mail von TanzRaum (noreply@tanzraum.app)
        geschickt. Sobald ein Elternteil zugestimmt hat, bekommst du eine E-Mail zum Bestätigen deiner Adresse – danach kannst
        du dich anmelden.
      </p>
      <p className="text-[13px] text-brand-ink-soft">
        Bis dahin ist dein Konto gesperrt. Stimmt niemand innerhalb von 14 Tagen zu, wird es automatisch gelöscht.
      </p>
      {kindId && (
        <button
          type="button"
          disabled={laeuft}
          onClick={() => starte(async () => setMeldung(await elternMailErneut(kindId)))}
          className="btn-secondary self-start"
        >
          E-Mail an meine Eltern erneut senden
        </button>
      )}
      {meldung?.error && <p className="form-error">{meldung.error}</p>}
      {meldung?.ok && <p className="form-success">{meldung.ok}</p>}
    </div>
  );
}

export function SignupForm({ weiter }: { weiter: string }) {
  const [state, formAction] = useActionState(signUp, initialState);
  const [kind, setKind] = useState(false);

  if (state.wartetAufEltern) return <ElternWarten kindId={state.kindId} mailFehler={state.mailFehler} />;

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
        <small className="text-[12px] text-brand-ink-soft">Nur für den Jugendschutz – wird niemandem angezeigt und kann später nicht selbst geändert werden.</small>
      </label>

      {kind && (
        <div className="flex flex-col gap-2 rounded-xl border border-brand-line bg-brand-bg p-3">
          <p className="text-[13px] text-brand-ink">
            <strong>Du bist unter 16.</strong> Dann braucht dein Konto die Zustimmung eines Elternteils. Deine Eltern bekommen dafür
            eine E-Mail – ein eigenes TanzRaum-Konto brauchen sie nicht. Bis zur Zustimmung ist dein Konto gesperrt.
          </p>
          <label className="field">
            <span>E-Mail-Adresse eines Elternteils</span>
            <input type="email" name="eltern_email" autoComplete="off" required />
          </label>
        </div>
      )}

      <label className="field">
        <span>Handle (optional)</span>
        <input type="text" name="handle" placeholder="z. B. kai.kern" />
      </label>

      <label className="field">
        <span>Geschlecht</span>
        <select name="gender" defaultValue="" required>
          <option value="" disabled>Bitte auswählen</option>
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
