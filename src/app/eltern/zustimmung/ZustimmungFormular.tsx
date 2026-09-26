"use client";

import { useActionState } from "react";
import { zustimmungEntscheiden, type ZustimmungsErgebnis } from "./actions";
import { SendenButton } from "@/components/ui/SendenButton";

const START: ZustimmungsErgebnis = { error: null };

export function ZustimmungFormular({ token, vorname, textversion }: { token: string; vorname: string; textversion: string }) {
  const [ergebnis, aktion] = useActionState(zustimmungEntscheiden, START);
  const kind = vorname || "dein Kind";

  if (ergebnis.ergebnis === "zugestimmt") {
    return (
      <div className="flex flex-col gap-3">
        <p className="form-success">
          Danke! Deine Zustimmung ist gespeichert und das Konto von {kind} ist freigeschaltet. {kind} bekommt jetzt eine E-Mail, um die
          eigene Adresse zu bestätigen. Du erhältst eine Bestätigung per E-Mail – darin kannst du auf Wunsch ein eigenes Elternkonto
          verknüpfen und die Schutzeinstellungen selbst verwalten.
        </p>
        {ergebnis.hinweis && <p className="form-error">{ergebnis.hinweis}</p>}
      </div>
    );
  }
  if (ergebnis.ergebnis === "abgelehnt") {
    return <p className="form-success">Du hast die Zustimmung abgelehnt. Das Konto wird nicht freigeschaltet.</p>;
  }

  return (
    <form action={aktion} className="auth-form">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="textversion" value={textversion} />
      <label className="flex items-start gap-2 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="erklaerung" value="ja" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red" />
        <span>
          <strong>Ich bin volljährig und Träger der elterlichen Verantwortung</strong> für {kind}. (Pflichtangabe)
        </span>
      </label>
      <label className="flex items-start gap-2 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="kinderkonto" value="ja" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red" />
        <span>
          Ich stimme zu, dass {kind} ein TanzRaum-Kinderkonto gemäß den{" "}
          <a href="/nutzungsbedingungen" target="_blank" className="underline">
            Nutzungsbedingungen
          </a>{" "}
          nutzt. Die{" "}
          <a href="/datenschutz" target="_blank" className="underline">
            Datenschutzerklärung
          </a>{" "}
          habe ich zur Kenntnis genommen. (Pflichtangabe)
        </span>
      </label>
      <label className="flex items-start gap-2 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="push" value="ja" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red" />
        <span>
          Optional: Ich willige ein, dass {kind} Push-Benachrichtigungen auf den eigenen Geräten einschalten darf. Die Einwilligung
          kann ich jederzeit widerrufen.
        </span>
      </label>
      {ergebnis.error && <p className="form-error">{ergebnis.error}</p>}
      <div className="flex flex-wrap gap-2">
        <SendenButton name="entscheidung" value="ja" laedtText="Wird gespeichert …">
          Zustimmen und Konto freischalten
        </SendenButton>
        <SendenButton name="entscheidung" value="nein" variante="sekundaer" laedtText="Wird gespeichert …">
          Ablehnen
        </SendenButton>
      </div>
    </form>
  );
}
