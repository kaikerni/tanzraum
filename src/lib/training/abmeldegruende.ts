// Feste Abmeldegruende (identisch mit dem Check in trainings_abmeldungen.grund_kategorie und
// abmeldegrund_text()/abmeldegrund_emoji() in der Datenbank). Neutral fuer jede Gruppe.
export const ABMELDEGRUENDE = [
  { wert: "krankheit", label: "Krank", emoji: "🤒" },
  { wert: "schule", label: "Schule", emoji: "🏫" },
  { wert: "urlaub", label: "Urlaub", emoji: "🏖️" },
  { wert: "arzttermin", label: "Arzttermin", emoji: "🩺" },
  { wert: "veranstaltung", label: "Andere Veranstaltung", emoji: "💃" },
  { wert: "familie", label: "Familie / privat", emoji: "👨‍👩‍👧" },
  { wert: "sonstiges", label: "Sonstiger Grund", emoji: "✏️" },
] as const;

export type Abmeldegrund = (typeof ABMELDEGRUENDE)[number]["wert"];

// Fruehere Gruende (vor der neuen Auswahl eingetragen) bleiben lesbar
const FRUEHER: Record<string, { label: string; emoji: string }> = {
  arbeit: { label: "Arbeit", emoji: "💼" },
  verletzung: { label: "Verletzung", emoji: "🩹" },
};

export function istAbmeldegrund(wert: string): wert is Abmeldegrund {
  return ABMELDEGRUENDE.some((g) => g.wert === wert);
}

// Anzeige eines Grundes: Emoji + Bezeichnung (+ optionaler Hinweis). Die Quelle (selbst/Eltern/Trainer) wird nie angezeigt.
export function grundAnzeige(kategorie: string | null | undefined, hinweis?: string | null, grund?: string | null) {
  const g = ABMELDEGRUENDE.find((x) => x.wert === kategorie) ?? (kategorie ? FRUEHER[kategorie] : undefined);
  if (g) return { emoji: g.emoji, label: g.label, hinweis: hinweis?.trim() || null };
  // Altbestand ohne Kategorie: gespeicherter Text ohne fruehere Quellenzusaetze
  const text = (grund ?? "").replace(/\s*\((manuell eingetragen|von den Eltern)\)\s*$/, "").trim();
  return { emoji: "✏️", label: text || "Abgemeldet", hinweis: null };
}
