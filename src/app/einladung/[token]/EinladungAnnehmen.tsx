"use client";

import { useActionState } from "react";
import Link from "next/link";
import { einladungEinloesen } from "@/app/dashboard/verein/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

// wechsel: die Person ist einem anderen Verein zugeordnet – Annehmen bedeutet ausdrueckliche Zustimmung zum Vereinswechsel
export function EinladungAnnehmen({ token, wechsel = false }: { token: string; wechsel?: boolean }) {
  const [ergebnis, aktion] = useActionState(einladungEinloesen, LEERES_ERGEBNIS);
  if (ergebnis.ok) return <Meldung ergebnis={ergebnis} />;
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {wechsel && <input type="hidden" name="wechsel" value="ja" />}
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird angenommen …" className="w-full">
        {wechsel ? "Verein wechseln und beitreten" : "Einladung annehmen"}
      </SendenButton>
      {wechsel && (
        <Link href="/dashboard" className="text-center text-[14px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          Ablehnen
        </Link>
      )}
    </form>
  );
}
