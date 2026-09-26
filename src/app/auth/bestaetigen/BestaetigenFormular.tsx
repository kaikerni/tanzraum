"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { linkEinloesen, type BestaetigenState } from "./actions";

const initialState: BestaetigenState = { fehler: false, teilweise: false };

function SubmitButton({ text }: { text: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Einen Moment…" : text}
    </button>
  );
}

function Fehler({ typ }: { typ: string }) {
  if (typ === "recovery") {
    return (
      <>
        <p className="form-error">Dieser Link ist abgelaufen oder wurde bereits verwendet.</p>
        <p className="auth-switch">
          <Link href="/passwort-vergessen">Neuen Link anfordern</Link>
        </p>
      </>
    );
  }
  if (typ === "email_change") {
    return (
      <>
        <p className="form-error">
          Dieser Link ist abgelaufen oder wurde bereits verwendet. Falls die Änderung noch nicht übernommen wurde, starte sie in den
          Einstellungen einfach neu.
        </p>
        <p className="auth-switch">
          <Link href="/dashboard/einstellungen">Zu den Einstellungen</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <p className="form-error">
        Dieser Link ist abgelaufen oder wurde bereits verwendet. Hast du deine E-Mail-Adresse schon bestätigt? Dann kannst du dich
        einfach anmelden. Sonst kannst du dir bei der Anmeldung einen neuen Bestätigungslink schicken lassen.
      </p>
      <p className="auth-switch">
        <Link href="/login">Zur Anmeldung</Link>
      </p>
    </>
  );
}

export function BestaetigenFormular({
  tokenHash,
  typ,
  weiter,
  buttonText,
}: {
  tokenHash: string;
  typ: string;
  weiter: string;
  buttonText: string;
}) {
  const [state, formAction] = useActionState(linkEinloesen, initialState);

  if (state.wartetAufEltern) {
    return (
      <p className="form-success">
        Dein Konto wartet noch auf die Zustimmung deiner Eltern. Sobald ein Elternteil zugestimmt hat, bekommst du eine neue E-Mail
        zum Bestätigen deiner Adresse – danach kannst du dich anmelden.
      </p>
    );
  }
  if (state.fehler) return <Fehler typ={typ} />;
  if (state.teilweise) {
    return (
      <p className="form-success">
        Danke, dieser Teil ist bestätigt. Zur Sicherheit muss die Änderung auch über den Link in der zweiten E-Mail bestätigt
        werden – wir haben sie an deine andere E-Mail-Adresse geschickt. Erst danach gilt die neue Adresse.
      </p>
    );
  }

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={typ} />
      <input type="hidden" name="weiter" value={weiter} />
      <SubmitButton text={buttonText} />
    </form>
  );
}
