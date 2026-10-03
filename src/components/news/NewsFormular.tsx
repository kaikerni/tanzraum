"use client";

import { useActionState, useState } from "react";
import { newsVeroeffentlichen } from "@/app/dashboard/news/actions";
import { SendenButton, Meldung, LEERES_ERGEBNIS } from "@/components/ui/SendenButton";
import type { VerfasserVerein } from "@/lib/news/getNews";
import { ZielAuswahl } from "./ZielAuswahl";

export function NewsFormular({ vereine }: { vereine: VerfasserVerein[] }) {
  const [vereinId, setVereinId] = useState(vereine[0]?.vereinId ?? "");
  const [runde, setRunde] = useState(0);
  const [ergebnis, aktion] = useActionState(async (prev: typeof LEERES_ERGEBNIS, fd: FormData) => {
    const r = await newsVeroeffentlichen(prev, fd);
    if (!r.error) setRunde((x) => x + 1);
    return r;
  }, LEERES_ERGEBNIS);
  const verein = vereine.find((v) => v.vereinId === vereinId) ?? vereine[0];

  return (
    <form key={runde} action={aktion} className="flex flex-col gap-3">
      {vereine.length > 1 ? (
        <label className="field">
          <span>Verein</span>
          <select name="verein_id" value={vereinId} onChange={(e) => setVereinId(e.target.value)}>
            {vereine.map((v) => (
              <option key={v.vereinId} value={v.vereinId}>
                {v.vereinName}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="verein_id" value={verein.vereinId} />
      )}
      <label className="field">
        <span>Titel</span>
        <input name="titel" required maxLength={150} placeholder="z. B. Training fällt heute aus" />
      </label>
      <label className="field">
        <span>Text</span>
        <textarea name="text" rows={4} maxLength={5000} />
      </label>
      <ZielAuswahl verein={verein} />
      <label className="flex items-start gap-2 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="wichtig" className="mt-0.5" />
        <span>
          <strong>Wichtig – als Popup</strong>
          <span className="block text-[12.5px] text-brand-ink-soft">
            Erscheint beim nächsten Öffnen als Hinweis und muss bestätigt werden (z. B. Trainingsausfall, Terminänderung).
          </span>
        </span>
      </label>
      <label className="flex items-center gap-2 text-[13.5px] text-brand-ink">
        <input type="checkbox" name="push" /> Zusätzlich Push-Benachrichtigung senden
      </label>
      <Meldung ergebnis={ergebnis} />
      <SendenButton laedtText="Wird veröffentlicht …">Veröffentlichen</SendenButton>
    </form>
  );
}
