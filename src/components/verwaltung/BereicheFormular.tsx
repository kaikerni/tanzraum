"use client";

import { useActionState } from "react";
import { bereicheSpeichern } from "@/app/dashboard/vereinsverwaltung/actions";
import { VEREINS_MODULE } from "@/lib/navigation";
import { LEERES_ERGEBNIS, Meldung, SendenButton } from "@/components/ui/SendenButton";

export function BereicheFormular({ vereinId, aus }: { vereinId: string; aus: string[] }) {
  const [ergebnis, aktion] = useActionState(bereicheSpeichern, LEERES_ERGEBNIS);
  return (
    <form action={aktion} className="flex flex-col gap-3">
      <input type="hidden" name="verein_id" value={vereinId} />
      <ul className="divide-y divide-brand-line">
        {VEREINS_MODULE.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-start gap-3 py-3">
              <input
                type="checkbox"
                name={`modul_${m.id}`}
                value="an"
                defaultChecked={!aus.includes(m.id)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#e11d2e]"
              />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold text-brand-ink">{m.label}</span>
                <span className="block text-[12.5px] text-brand-ink-soft">{m.text}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Meldung ergebnis={ergebnis} />
      <div>
        <SendenButton>Bereiche speichern</SendenButton>
      </div>
    </form>
  );
}
