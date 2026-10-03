"use client";

import { useActionState } from "react";
import { Ticket } from "lucide-react";
import { einladungEinloesen } from "@/app/dashboard/verein/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import { VereinSuchen, type MeineAnfrage } from "./VereinSuchen";
import { VereinslizenzErforderlich } from "./VereinslizenzErforderlich";
import type { VereinsgruendungStatus } from "@/lib/tarife";

const KARTE = "rounded-[var(--radius-l)] border border-brand-line bg-white p-5 shadow-[var(--shadow)]";

export function OhneVerein({ anfragen = [], gruendung = null }: { anfragen?: MeineAnfrage[]; gruendung?: VereinsgruendungStatus | null }) {
  const [einladung, einloesen] = useActionState(einladungEinloesen, LEERES_ERGEBNIS);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <VereinSuchen anfragen={anfragen} />
      <section className={KARTE}>
        <div className="mb-3 flex items-center gap-2.5">
          <Ticket size={20} className="text-brand-red" />
          <h2 className="text-[16px] font-bold text-brand-ink">Einladung einlösen</h2>
        </div>
        <p className="mb-4 text-[13px] text-brand-ink-soft">
          Du hast von deinem Verein einen Einladungslink bekommen? Füge ihn hier ein – du wirst dann mit der vorgesehenen
          Rolle Mitglied.
        </p>
        <form action={einloesen} className="flex flex-col gap-3">
          <label className="field">
            <span>Einladungslink oder Code</span>
            <input name="token" required placeholder="https://…/einladung/…" />
          </label>
          <Meldung ergebnis={einladung} />
          <div>
            <SendenButton laedtText="Wird eingelöst …">Beitreten</SendenButton>
          </div>
        </form>
      </section>

      <VereinslizenzErforderlich gruendung={gruendung} />
    </div>
  );
}
