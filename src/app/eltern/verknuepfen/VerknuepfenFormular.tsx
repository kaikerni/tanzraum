"use client";

import { useActionState } from "react";
import Link from "next/link";
import { mitKindVerknuepfen } from "./actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export function VerknuepfenFormular({ token }: { token: string }) {
  const [ergebnis, aktion] = useActionState(mitKindVerknuepfen, LEERES_ERGEBNIS);
  if (ergebnis.ok) {
    return (
      <div className="flex flex-col gap-3">
        <p className="form-success">{ergebnis.ok}</p>
        <Link href="/dashboard/einstellungen" className="btn-primary text-center">
          Zu den Einstellungen
        </Link>
      </div>
    );
  }
  return (
    <form action={aktion} className="auth-form">
      <input type="hidden" name="token" value={token} />
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird verknüpft …">Mit meinem Kind verknüpfen</SendenButton>
    </form>
  );
}
