"use client";

import { useActionState } from "react";
import { Ticket, Building2 } from "lucide-react";
import { einladungEinloesen, vereinNeuAnlegen } from "@/app/dashboard/verein/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

const KARTE = "rounded-[var(--radius-l)] border border-brand-line bg-white p-5 shadow-[var(--shadow)]";

export function OhneVerein() {
  const [einladung, einloesen] = useActionState(einladungEinloesen, LEERES_ERGEBNIS);
  const [neu, anlegen] = useActionState(vereinNeuAnlegen, LEERES_ERGEBNIS);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

      <section className={KARTE}>
        <div className="mb-3 flex items-center gap-2.5">
          <Building2 size={20} className="text-brand-gold" />
          <h2 className="text-[16px] font-bold text-brand-ink">Verein registrieren</h2>
        </div>
        <p className="mb-2 text-[13px] text-brand-ink-soft">
          Vereinsverwaltung gibt es in TanzRaum nur mit der Verein-Lizenz. So geht&apos;s:
        </p>
        <ol className="mb-4 list-decimal pl-5 text-[13px] text-brand-ink-soft">
          <li>Verein registrieren – du wirst Vereinsadmin</li>
          <li>Verein-Lizenz abschließen</li>
          <li>Vereinsdaten und Bereiche einrichten</li>
          <li>Mitglieder einladen bzw. hinzufügen</li>
        </ol>
        <form action={anlegen} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <label className="field">
              <span>Vereinsname</span>
              <input name="name" required placeholder="z. B. Karnevalsclub Musterstadt" />
            </label>
            <label className="field">
              <span>Kürzel</span>
              <input name="kuerzel" placeholder="z. B. KCM" />
            </label>
          </div>
          <Meldung ergebnis={neu} />
          <div>
            <SendenButton laedtText="Wird registriert …" variante="sekundaer">
              Verein registrieren
            </SendenButton>
          </div>
        </form>
      </section>
    </div>
  );
}
