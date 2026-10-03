"use client";

import Link from "next/link";
import { TanzRaumAssistant } from "@/components/kai/TanzRaumAssistant";

// Fehlerseite innerhalb der App (z. B. Server nicht erreichbar oder Seite aus einem aelteren Stand nach einem Update).
// Zeigt einen verstaendlichen Hinweis statt "Application error"; der Fehler selbst erscheint weiterhin in der
// Browser-Konsole und im Serverprotokoll.
export default function Fehler({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <TanzRaumAssistant variant="warning" size="kompakt" className="mb-3 text-left" message="Hoppla – hier hat etwas nicht geklappt. Keine Sorge, deine Daten sind sicher." />
        <h1 className="brand-font">Da ist etwas schiefgelaufen</h1>
        <p className="subtitle">
          Die Aktion konnte nicht abgeschlossen werden. Häufig hilft es, die Seite neu zu laden – zum Beispiel wenn TanzRaum gerade
          aktualisiert wurde.
        </p>
        {error.digest && <p className="text-[12px] text-brand-ink-soft">Fehlerkennung: {error.digest}</p>}
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Seite neu laden
        </button>
        <p className="auth-switch">
          <Link href="/login">Zur Anmeldung</Link>
        </p>
      </div>
    </div>
  );
}
