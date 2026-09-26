// Feste Abmeldegruende (identisch mit dem Check in trainings_abmeldungen.grund_kategorie)
export const ABMELDEGRUENDE = [
  { wert: "krankheit", label: "Krankheit" },
  { wert: "verletzung", label: "Verletzung" },
  { wert: "urlaub", label: "Urlaub" },
  { wert: "schule", label: "Schule / Ausbildung" },
  { wert: "arbeit", label: "Arbeit" },
  { wert: "familie", label: "Familie / privater Termin" },
  { wert: "sonstiges", label: "Sonstiges" },
] as const;

export type Abmeldegrund = (typeof ABMELDEGRUENDE)[number]["wert"];

export function istAbmeldegrund(wert: string): wert is Abmeldegrund {
  return ABMELDEGRUENDE.some((g) => g.wert === wert);
}
