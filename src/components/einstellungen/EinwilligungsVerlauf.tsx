export type Einwilligung = { id: string; art: string; version: string; erteilt: boolean; quelle: string; zeitpunkt: string };

const ART: Record<string, string> = {
  nutzungsbedingungen: "Nutzungsbedingungen",
  datenschutz_kenntnis: "Datenschutzerklärung (zur Kenntnis genommen)",
  eltern_zustimmung: "Zustimmung eines Elternteils (Kinderkonto)",
  push: "Push-Benachrichtigungen",
  map: "Anzeige auf der TanzRaum Map",
};
const QUELLE: Record<string, string> = {
  registrierung: "bei der Registrierung",
  einstellungen: "in den Einstellungen",
  geraet: "auf einem Gerät",
  eltern_link: "durch ein Elternteil (E-Mail-Link)",
  eltern_einstellung: "durch ein verknüpftes Elternteil",
};

// Nachweis der eigenen Einwilligungen (nur lesen; Aenderungen erzeugen neue Eintraege)
export function EinwilligungsVerlauf({ liste }: { liste: Einwilligung[] }) {
  if (liste.length === 0) return <p className="text-[13px] text-brand-ink-soft">Noch keine Einträge.</p>;
  return (
    <ul className="flex flex-col gap-1.5 text-[13px]">
      {liste.map((e) => (
        <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-brand-bg px-3 py-2">
          <span className="font-medium text-brand-ink">
            {ART[e.art] ?? e.art}: {e.erteilt ? "zugestimmt" : "widerrufen / abgelehnt"}
          </span>
          <span className="text-[12px] text-brand-ink-soft">
            {new Date(e.zeitpunkt).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" })} ·{" "}
            {QUELLE[e.quelle] ?? e.quelle} · Fassung {e.version.split(" | ")[0]}
          </span>
        </li>
      ))}
    </ul>
  );
}
