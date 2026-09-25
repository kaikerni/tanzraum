import Link from "next/link";
import { internerPfad } from "@/lib/url";
import { LINK_TYPEN } from "./typen";
import { BestaetigenFormular } from "./BestaetigenFormular";

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

export default async function BestaetigenSeite({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; weiter?: string }>;
}) {
  const { token_hash: tokenHash, type, weiter } = await searchParams;
  const gueltig = !!tokenHash && /^[A-Za-z0-9_-]{8,200}$/.test(tokenHash) && !!type && (LINK_TYPEN as readonly string[]).includes(type);
  const texte = gueltig ? TEXTE[type!] : null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        {texte ? (
          <>
            <h1 className="brand-font">{texte.titel}</h1>
            <p className="subtitle">{texte.text}</p>
            <BestaetigenFormular tokenHash={tokenHash!} typ={type!} weiter={internerPfad(weiter)} buttonText={texte.button} />
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
