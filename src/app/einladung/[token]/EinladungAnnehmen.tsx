"use client";

import { useActionState } from "react";
import { einladungEinloesen } from "@/app/dashboard/verein/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export function EinladungAnnehmen({ token }: { token: string }) {
  const [ergebnis, aktion] = useActionState(einladungEinloesen, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird beigetreten …" className="w-full">
        Beitreten
      </SendenButton>
    </form>
  );
}
