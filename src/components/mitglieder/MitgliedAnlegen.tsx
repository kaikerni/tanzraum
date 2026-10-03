"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { mitgliedAnlegen } from "@/app/dashboard/mitglieder/actions";
import { SendenButton } from "@/components/ui/SendenButton";

// „+ Mitglied anlegen“: Vereinsmitglied ohne TanzRaum-Konto – Einladung danach per E-Mail oder persoenlichem Link
export function MitgliedAnlegen({ vereinId, gruppen }: { vereinId: string; gruppen: { id: string; name: string }[] }) {
  const [zustand, aktion] = useActionState(mitgliedAnlegen.bind(null, vereinId), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (zustand?.ok) form.current?.reset();
  }, [zustand]);
  return (
    <form ref={form} action={aktion} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Vorname</span>
          <input name="vorname" required maxLength={100} autoComplete="off" />
        </label>
        <label className="field">
          <span>Nachname</span>
          <input name="nachname" required maxLength={100} autoComplete="off" />
        </label>
        <label className="field">
          <span>E-Mail-Adresse (für die Einladung)</span>
          <input name="email" type="email" maxLength={254} autoComplete="off" placeholder="optional" />
        </label>
        <label className="field">
          <span>Mitgliedsnummer</span>
          <input name="mitgliedsnummer" maxLength={50} autoComplete="off" placeholder="optional" />
        </label>
        {gruppen.length > 0 && (
          <label className="field sm:col-span-2">
            <span>Gruppe</span>
            <select name="gruppe_id" defaultValue="">
              <option value="">keine Gruppe</option>
              {gruppen.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="text-[12.5px] text-brand-ink-soft">
        Es wird kein TanzRaum-Konto erstellt. Das Mitglied erscheint in der Mitgliederliste als „Noch kein TanzRaum-Konto“ und kann dort per
        E-Mail oder persönlichem Einladungslink eingeladen werden.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SendenButton laedtText="Wird angelegt …">Mitglied anlegen</SendenButton>
        {zustand?.ok && (
          <Link href={`/dashboard/mitglieder?verein=${vereinId}&konto=ohne`} className="text-[13.5px] font-semibold text-brand-red hover:underline">
            Jetzt einladen →
          </Link>
        )}
      </div>
      {zustand?.error && <p className="form-error">{zustand.error}</p>}
      {zustand?.ok && <p className="text-[13.5px] font-semibold text-brand-green">{zustand.ok}</p>}
    </form>
  );
}
