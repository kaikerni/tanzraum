"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { vereinAnlegen, vereinSchrittUeberspringen } from "../actions";

type State = { error: string | null };
const initialState: State = { error: null };

async function anlegenAction(_prev: State, formData: FormData): Promise<State> {
  const result = await vereinAnlegen(formData);
  return result ?? { error: null };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Wird angelegt…" : "Verein anlegen"}
    </button>
  );
}

export function VereinForm() {
  const [state, formAction] = useActionState(anlegenAction, initialState);

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="auth-form">
        <label className="field">
          <span>Vereinsname</span>
          <input type="text" name="name" required placeholder="z. B. Karnevalsclub Musterstadt" />
        </label>
        <label className="field">
          <span>Kürzel (optional)</span>
          <input type="text" name="kuerzel" placeholder="z. B. KCM" />
        </label>
        {state.error && <p className="form-error">{state.error}</p>}
        <SubmitButton />
      </form>

      <div className="flex items-center gap-3 text-[12px] text-brand-ink-soft">
        <div className="h-px flex-1 bg-brand-line" />
        oder
        <div className="h-px flex-1 bg-brand-line" />
      </div>

      <form action={vereinSchrittUeberspringen}>
        <button type="submit" className="btn-secondary w-full">
          Überspringen — ich bin nur persönlich dabei oder trete später per Einladung bei
        </button>
      </form>
    </div>
  );
}
