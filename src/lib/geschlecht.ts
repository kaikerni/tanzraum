// Geschlecht (Pflichtangabe) und persoenliche Bezeichnung in Profil und Mitgliederliste.
// Weiblich -> "Tänzerin", maennlich -> "Tänzer", divers/ohne Angabe -> neutral "Tänzer/in".
// Keine kuenstliche Anrede in Begruessungen, Chat oder Spotlights.

export const GESCHLECHTER = ["weiblich", "männlich", "divers"] as const;
export type Geschlecht = (typeof GESCHLECHTER)[number];

export function istGeschlecht(wert: unknown): wert is Geschlecht {
  return typeof wert === "string" && (GESCHLECHTER as readonly string[]).includes(wert);
}

export type Funktion = "mitglied" | "trainer" | "betreuer";

const FORMEN: Record<Funktion, { weiblich: string; männlich: string; neutral: string }> = {
  mitglied: { weiblich: "Tänzerin", männlich: "Tänzer", neutral: "Tänzer/in" },
  trainer: { weiblich: "Trainerin", männlich: "Trainer", neutral: "Trainer/in" },
  betreuer: { weiblich: "Betreuerin", männlich: "Betreuer", neutral: "Betreuer/in" },
};

export function funktionsBezeichnung(funktion: Funktion, geschlecht: string | null | undefined): string {
  const f = FORMEN[funktion];
  return geschlecht === "weiblich" ? f.weiblich : geschlecht === "männlich" ? f.männlich : f.neutral;
}

// Wie rollen_typ() in der Datenbank: Tänzer-, Trainer- und Betreuer-Rollen werden nach Geschlecht bezeichnet,
// alle anderen Rollen (Vereins-Admin, Eltern, ...) bleiben unverändert.
export function rollenBezeichnung(rolle: string | null, geschlecht: string | null | undefined): string | null {
  if (!rolle) return rolle;
  const r = rolle.toLowerCase();
  if (r.includes("admin")) return rolle;
  if (r.includes("trainer")) return funktionsBezeichnung("trainer", geschlecht);
  if (r.includes("betreuer")) return funktionsBezeichnung("betreuer", geschlecht);
  if (r.startsWith("tänzer")) return funktionsBezeichnung("mitglied", geschlecht);
  return rolle;
}
