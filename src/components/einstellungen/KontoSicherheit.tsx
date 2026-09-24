"use client";

import { useActionState } from "react";
import { emailAendern, passwortAendern } from "@/app/dashboard/einstellungen/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

export function EmailAendern({ aktuell, ausstehend }: { aktuell: string; ausstehend: string | null }) {
  const [ergebnis, aktion] = useActionState(emailAendern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <p className="text-[13.5px] text-brand-ink-soft">
        Aktuell: <strong className="text-brand-ink">{aktuell}</strong>
        {ausstehend && (
          <>
            <br />
            Wartet auf Bestätigung: <strong className="text-brand-ink">{ausstehend}</strong>
          </>
        )}
      </p>
      <label className="field">
        <span>Neue E-Mail-Adresse</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gesendet …" className="self-start">
        E-Mail-Adresse ändern
      </SendenButton>
    </form>
  );
}

export function PasswortAendern() {
  const [ergebnis, aktion] = useActionState(passwortAendern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <label className="field">
        <span>Aktuelles Passwort</span>
        <input type="password" name="aktuell" autoComplete="current-password" required />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Neues Passwort</span>
          <input type="password" name="neu" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="field">
          <span>Neues Passwort wiederholen</span>
          <input type="password" name="wiederholung" autoComplete="new-password" minLength={8} required />
        </label>
      </div>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gespeichert …" className="self-start">
        Passwort ändern
      </SendenButton>
    </form>
  );
}
