import Link from "next/link";
import { EinmalFormular } from "@/components/ui/EinmalFormular";
import { internerPfad } from "@/lib/url";
import { LINK_TYPEN } from "./typen";

export const metadata = { title: "Bestätigen – TanzRaum" };

const TEXTE: Record<string, { titel: string; text: string; button: string }> = {
  email: {
    titel: "E-Mail-Adresse bestätigen",
    text: "Nur noch ein Klick: Bestätige deine E-Mail-Adresse, um dein TanzRaum-Konto zu aktivieren.",
    button: "E-Mail-Adresse bestätigen",
  },
  recovery: {
    titel: "Passwort zurücksetzen",
    text: "Klicke auf den Button, um im nächsten Schritt ein neues Passwort festzulegen.",
    button: "Weiter zum neuen Passwort",
  },
  email_change: {
    titel: "E-Mail-Änderung bestätigen",
    text: "Bestätige die Änderung der E-Mail-Adresse deines TanzRaum-Kontos.",
    button: "Änderung bestätigen",
  },
  invite: {
    titel: "Einladung annehmen",
    text: "Bestätige die Einladung, um dein TanzRaum-Konto zu aktivieren.",
    button: "Einladung annehmen",
  },
};

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

function Ergebnis({ status, typ }: { status: string; typ: string }) {
  if (status === "eltern") {
    return (
      <p className="form-success">
        Dein Konto wartet noch auf die Zustimmung deiner Eltern. Sobald ein Elternteil zugestimmt hat, bekommst du eine neue E-Mail
        zum Bestätigen deiner Adresse – danach kannst du dich anmelden.
      </p>
    );
  }
  if (status === "teilweise") {
    return (
      <p className="form-success">
        Danke, dieser Teil ist bestätigt. Zur Sicherheit muss die Änderung auch über den Link in der zweiten E-Mail bestätigt
        werden – wir haben sie an deine andere E-Mail-Adresse geschickt. Erst danach gilt die neue Adresse.
      </p>
    );
  }
  return <Fehler typ={typ} />;
}

// Der Link aus der E-Mail wird erst nach einem Klick eingeloest (schuetzt vor Link-Vorschauen/Virenscannern, die
// Links vorab oeffnen). Das Formular sendet an den Route Handler ./einloesen (keine Server Action).
export default async function BestaetigenSeite({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; weiter?: string; status?: string }>;
}) {
  const { token_hash: tokenHash, type, weiter, status } = await searchParams;
  const typGueltig = !!type && (LINK_TYPEN as readonly string[]).includes(type);
  const gueltig = typGueltig && !!tokenHash && /^[A-Za-z0-9_-]{8,200}$/.test(tokenHash);
  const texte = typGueltig ? TEXTE[type!] : null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        {status && texte ? (
          <>
            <h1 className="brand-font">{texte.titel}</h1>
            <Ergebnis status={status} typ={type!} />
          </>
        ) : gueltig && texte ? (
          <>
            <h1 className="brand-font">{texte.titel}</h1>
            <p className="subtitle">{texte.text}</p>
            <EinmalFormular action="/auth/bestaetigen/einloesen" knopf={texte.button}>
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="weiter" value={internerPfad(weiter)} />
            </EinmalFormular>
          </>
        ) : (
          <>
            <h1 className="brand-font">Link unvollständig</h1>
            <p className="subtitle">
              Dieser Link ist unvollständig oder beschädigt. Öffne ihn bitte direkt aus der E-Mail oder kopiere ihn vollständig in
              deinen Browser.
            </p>
            <p className="auth-switch">
              <Link href="/login">Zur Anmeldung</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
