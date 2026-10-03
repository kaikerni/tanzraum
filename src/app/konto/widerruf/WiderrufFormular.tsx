"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loeschungWiderrufen, type WiderrufStand } from "./actions";

function Knopf() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Einen Moment …" : "Löschung widerrufen"}
    </button>
  );
}

export function WiderrufFormular({ token }: { token: string }) {
  const [state, aktion] = useActionState(loeschungWiderrufen, { error: null, ok: false } as WiderrufStand);
  if (state.ok) {
    return (
      <>
        <p className="rounded-lg bg-brand-green-wash px-3 py-2 text-[13.5px] text-brand-green">
          Die Löschung wurde widerrufen. Dein Konto ist wieder freigeschaltet.
        </p>
        <Link href="/login" className="btn-primary w-full text-center">
          Jetzt anmelden
        </Link>
      </>
    );
  }
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <p className="form-error">{state.error}</p>}
      <Knopf />
    </form>
  );
}
