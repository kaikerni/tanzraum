"use client";

import { useActionState, useState, useTransition } from "react";
import { emailAendern, kontoPrivatSetzen, onlineSichtbarSetzen, passwortAendern, vereinAngabeSetzen } from "@/app/dashboard/einstellungen/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS, type AktionsErgebnis } from "@/components/ui/SendenButton";

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

export function PrivatSchalter({ privat: start }: { privat: boolean }) {
  const [privat, setPrivat] = useState(start);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span className="text-[13.5px] text-brand-ink">
          <strong>Privates Konto</strong>
          <br />
          <span className="text-brand-ink-soft">
            Du wirst in der Personensuche und im Netzwerk nicht gefunden. Mitglieder deines Vereins sehen dein Profil weiterhin.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={privat}
          disabled={laeuft}
          onChange={(e) => {
            const neu = e.target.checked;
            setPrivat(neu);
            starte(async () => {
              const r = await kontoPrivatSetzen(neu);
              if (r.error) setPrivat(!neu);
              setMeldung(r);
            });
          }}
          className="mt-1 h-5 w-5 shrink-0 accent-brand-red"
        />
      </label>
      {meldung && <Meldung ergebnis={meldung} />}
    </div>
  );
}

export function OnlineSchalter({ sichtbar: start }: { sichtbar: boolean }) {
  const [sichtbar, setSichtbar] = useState(start);
  const [meldung, setMeldung] = useState<AktionsErgebnis | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span className="text-[13.5px] text-brand-ink">
          <strong>Online-Status zeigen</strong>
          <br />
          <span className="text-brand-ink-soft">
            Deine Kontakte und Mitglieder deines Vereins sehen, wenn du gerade online bist (Standard: an). Schaltest du es aus, wirst du
            für andere Nutzer weder als online angezeigt noch mitgezählt; nur die TanzRaum-Administration sieht, dass dein Online-Status
            ausgeschaltet ist. Unter 16 Jahren wird der Status anderen Nutzern nie mit Namen gezeigt.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={sichtbar}
          disabled={laeuft}
          onChange={(e) => {
            const neu = e.target.checked;
            setSichtbar(neu);
            starte(async () => {
              const r = await onlineSichtbarSetzen(neu);
              if (r.error) setSichtbar(!neu);
              setMeldung(r);
            });
          }}
          className="mt-1 h-5 w-5 shrink-0 accent-brand-red"
        />
      </label>
      {meldung && <Meldung ergebnis={meldung} />}
    </div>
  );
}

// "Verein, in dem ich tanze": freiwillige Freitextangabe im Profil -- keine offizielle Vereinszuordnung
export function VereinAngabe({ wert }: { wert: string | null }) {
  const [ergebnis, aktion] = useActionState(vereinAngabeSetzen, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <label className="field">
        <span>Verein, in dem ich tanze</span>
        <input name="verein_angabe" defaultValue={wert ?? ""} maxLength={100} placeholder="z. B. TSC Musterstadt" />
      </label>
      <p className="text-[12.5px] text-brand-ink-soft">
        Freiwillig und nur eine Info in deinem Profil. Das ist keine offizielle Vereinszugehörigkeit: Es entstehen keine Rechte und keine Verknüpfung
        mit dem Verein. Offiziell Mitglied wirst du nur, wenn dich ein Verein mit Verein-Lizenz aufnimmt.
      </p>
      <Meldung ergebnis={ergebnis} />
      <div className="flex flex-wrap gap-2">
        <SendenButton>Speichern</SendenButton>
        {wert && (
          <SendenButton variante="sekundaer" name="aktion" value="loeschen" laedtText="Wird entfernt …">
            Angabe löschen
          </SendenButton>
        )}
      </div>
    </form>
  );
}
