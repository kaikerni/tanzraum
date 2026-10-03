"use client";

import { useActionState } from "react";
import Link from "next/link";
import { freischaltungAnnehmen } from "./actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export function FreischaltungAnnehmen({ token }: { token: string }) {
  const [ergebnis, aktion] = useActionState(freischaltungAnnehmen, LEERES_ERGEBNIS);
  if (ergebnis.ok) {
    return (
      <div className="flex flex-col gap-3">
        <Meldung ergebnis={ergebnis} />
        <Link href="/dashboard/tarif" className="btn-primary text-center">
          Zu „Mein Tarif & Lizenz“
        </Link>
      </div>
    );
  }
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird aktiviert …" className="w-full">
        Einladung annehmen
      </SendenButton>
    </form>
  );
}
