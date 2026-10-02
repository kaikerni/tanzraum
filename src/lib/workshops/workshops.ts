// 🎓 Workshops: Typen, Auswahllisten und Anzeige-Helfer (Pruefung und Rechte in der Datenbank)

export const BUNDESLAENDER = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
] as const;

export const WORKSHOP_KATEGORIEN: { id: string; label: string }[] = [
  { id: "gardetanz", label: "Gardetanz" },
  { id: "schautanz", label: "Schautanz" },
  { id: "technik", label: "Technik" },
  { id: "akrobatik", label: "Akrobatik" },
  { id: "choreografie", label: "Choreografie" },
  { id: "trainer", label: "Trainerfortbildung" },
  { id: "nachwuchs", label: "Nachwuchs" },
  { id: "sonstiges", label: "Sonstiges" },
];
export const KATEGORIE_LABEL: Record<string, string> = Object.fromEntries(WORKSHOP_KATEGORIEN.map((k) => [k.id, k.label]));

export const STATUS_LABEL: Record<string, string> = {
  entwurf: "Entwurf",
  eingereicht: "Eingereicht – wird geprüft",
  freigegeben: "Freigegeben",
  abgelehnt: "Abgelehnt",
  archiviert: "Archiviert",
};

export type Workshop = {
  id: string;
  titel: string;
  datum: string;
  datum_bis: string | null;
  uhrzeit_von: string | null;
  uhrzeit_bis: string | null;
  ausrichter: string;
  ort: string;
  adresse: string | null;
  bundesland: string;
  kategorie: string | null;
  beschreibung: string;
  ansprechpartner: string | null;
  kontakt: string | null;
  link: string | null;
  bild_pfad: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  ablehnungsgrund: string | null;
  eingereicht_von: string | null;
  erstellt_am: string;
};

export const WORKSHOP_SPALTEN =
  "id, titel, datum, datum_bis, uhrzeit_von, uhrzeit_bis, ausrichter, ort, adresse, bundesland, kategorie, beschreibung, ansprechpartner, kontakt, link, bild_pfad, lat, lng, status, ablehnungsgrund, eingereicht_von, erstellt_am";

export const heuteBerlin = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

export const istVergangen = (w: Pick<Workshop, "datum" | "datum_bis">) => (w.datum_bis ?? w.datum) < heuteBerlin();

const TAG = (iso: string, mitWochentag = false) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", ...(mitWochentag ? { weekday: "short" } : {}) });

export function datumText(w: Pick<Workshop, "datum" | "datum_bis">, mitWochentag = false): string {
  return w.datum_bis && w.datum_bis !== w.datum ? `${TAG(w.datum, mitWochentag)} – ${TAG(w.datum_bis, mitWochentag)}` : TAG(w.datum, mitWochentag);
}

export function uhrzeitText(w: Pick<Workshop, "uhrzeit_von" | "uhrzeit_bis">): string | null {
  if (!w.uhrzeit_von) return null;
  const k = (t: string) => t.slice(0, 5);
  return w.uhrzeit_bis ? `${k(w.uhrzeit_von)} – ${k(w.uhrzeit_bis)} Uhr` : `ab ${k(w.uhrzeit_von)} Uhr`;
}

// Kontakt als Link (E-Mail oder Telefon), sonst Text
export function kontaktLink(kontakt: string): string | null {
  const k = kontakt.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return `mailto:${k}`;
  if (/^\+?[0-9 ()/-]{6,}$/.test(k)) return `tel:${k.replace(/[^0-9+]/g, "")}`;
  return null;
}
