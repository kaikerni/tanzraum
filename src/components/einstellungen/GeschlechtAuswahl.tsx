"use client";

import { useActionState } from "react";
import { geschlechtAendern, geschlechtErfassen } from "@/app/geschlecht/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";

// "erfassen": einmalige Pflichtabfrage (weiter zum Dashboard), "aendern": Einstellungen
export function GeschlechtAuswahl({ modus, aktuell }: { modus: "erfassen" | "aendern"; aktuell: string | null }) {
  const [ergebnis, aktion] = useActionState(modus === "erfassen" ? geschlechtErfassen : geschlechtAendern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="auth-form">
      <label className="field">
        <span>Geschlecht</span>
        <select name="geschlecht" defaultValue={aktuell ?? ""} required>
          <option value="" disabled>
            Bitte auswählen
          </option>
          <option value="weiblich">weiblich</option>
          <option value="männlich">männlich</option>
          <option value="divers">divers</option>
        </select>
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird gespeichert …">{modus === "erfassen" ? "Speichern und weiter" : "Speichern"}</SendenButton>
    </form>
  );
}
