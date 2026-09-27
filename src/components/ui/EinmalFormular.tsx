"use client";

import { useEffect, useState, type ReactNode } from "react";

// Normales HTML-Formular (POST an einen Route Handler). Mit JavaScript wird doppeltes Absenden verhindert
// (wichtig bei Einmal-Links: ein zweiter Klick wuerde den bereits eingeloesten Link erneut pruefen).
// Ohne JavaScript funktioniert es als einfaches Formular.
export function EinmalFormular({
  action,
  knopf,
  ladeText = "Einen Moment…",
  children,
}: {
  action: string;
  knopf: string;
  ladeText?: string;
  children?: ReactNode;
}) {
  const [sendet, setSendet] = useState(false);

  // Zurueck-Taste (Seite aus dem Browser-Cache): Knopf wieder freigeben
  useEffect(() => {
    const zurueck = (e: PageTransitionEvent) => {
      if (e.persisted) setSendet(false);
    };
    window.addEventListener("pageshow", zurueck);
    return () => window.removeEventListener("pageshow", zurueck);
  }, []);

  return (
    <form
      method="post"
      action={action}
      className="auth-form"
      onSubmit={(e) => {
        if (sendet) e.preventDefault();
        else setSendet(true);
      }}
    >
      {children}
      <button type="submit" className="btn-primary" disabled={sendet}>
        {sendet ? ladeText : knopf}
      </button>
    </form>
  );
}
