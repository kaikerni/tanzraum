// Felder des Mitgliederimports, sichere Spaltenerkennung und Aufbereitung der Werte.
// Erkannt werden nur eindeutige Spaltennamen – im Zweifel bleibt eine Spalte „Nicht importieren“.

import { excelDatum } from "./tabelle";

export type FeldKey =
  | "vorname"
  | "nachname"
  | "name"
  | "email"
  | "geburtsdatum"
  | "geschlecht"
  | "telefon"
  | "strasse"
  | "hausnummer"
  | "plz"
  | "ort"
  | "mitgliedsnummer"
  | "eintrittsdatum"
  | "mitgliedsstatus"
  | "gruppe";

export type FeldGruppe = "persoenlich" | "verein" | "gruppen";

export type Feld = { key: FeldKey; label: string; gruppe: FeldGruppe; standard: boolean; synonyme: string[] };

// standard: vorausgewaehlt (nur Basisdaten). Weitere personenbezogene Daten waehlt der Vereinsadmin bewusst aus.
export const FELDER: Feld[] = [
  { key: "vorname", label: "Vorname", gruppe: "persoenlich", standard: true, synonyme: ["vorname", "vornamen", "rufname", "firstname", "givenname"] },
  { key: "nachname", label: "Nachname", gruppe: "persoenlich", standard: true, synonyme: ["nachname", "familienname", "zuname", "lastname", "surname"] },
  { key: "name", label: "Name (Vor- und Nachname in einer Spalte)", gruppe: "persoenlich", standard: true, synonyme: ["vollständigername", "vollername", "fullname", "vornameundnachname", "nachnamevorname", "namevorname"] },
  { key: "email", label: "E-Mail-Adresse", gruppe: "persoenlich", standard: true, synonyme: ["email", "mail", "emailadresse", "mailadresse", "emailaddress", "emailprivat", "privateemail"] },
  { key: "geburtsdatum", label: "Geburtsdatum", gruppe: "persoenlich", standard: false, synonyme: ["geburtsdatum", "geb", "gebdatum", "gebdat", "geburtstag", "geboren", "gebam", "birthday", "dateofbirth", "birthdate"] },
  { key: "geschlecht", label: "Geschlecht", gruppe: "persoenlich", standard: false, synonyme: ["geschlecht", "gender", "sex", "anrede"] },
  { key: "telefon", label: "Telefonnummer", gruppe: "persoenlich", standard: false, synonyme: ["telefon", "tel", "telefonnummer", "telnr", "handy", "handynummer", "mobil", "mobilnummer", "mobiltelefon", "phone", "mobile", "telefonprivat"] },
  { key: "strasse", label: "Straße", gruppe: "persoenlich", standard: false, synonyme: ["strasse", "str", "strassehausnummer", "strassenr", "adresse", "anschrift", "street"] },
  { key: "hausnummer", label: "Hausnummer", gruppe: "persoenlich", standard: false, synonyme: ["hausnummer", "hausnr"] },
  { key: "plz", label: "PLZ", gruppe: "persoenlich", standard: false, synonyme: ["plz", "postleitzahl", "zip", "postcode"] },
  { key: "ort", label: "Ort", gruppe: "persoenlich", standard: false, synonyme: ["ort", "wohnort", "stadt", "city"] },
  { key: "mitgliedsnummer", label: "Mitgliedsnummer", gruppe: "verein", standard: true, synonyme: ["mitgliedsnummer", "mitgliedsnr", "mitglnr", "mitgliednr", "mitgliednummer", "mitgliedernummer", "mitgliedsid", "membernumber", "memberid"] },
  { key: "eintrittsdatum", label: "Eintrittsdatum", gruppe: "verein", standard: false, synonyme: ["eintrittsdatum", "eintritt", "eintrittam", "mitgliedseit", "beitrittsdatum", "beitritt", "mitgliedsbeginn"] },
  { key: "mitgliedsstatus", label: "Mitgliedsstatus", gruppe: "verein", standard: false, synonyme: ["mitgliedsstatus", "status", "mitgliedschaft", "mitgliedsart"] },
  { key: "gruppe", label: "Gruppenzuordnung", gruppe: "gruppen", standard: true, synonyme: ["gruppe", "gruppen", "tanzgruppe", "abteilung", "mannschaft", "team", "garde"] },
];

export const FELD = Object.fromEntries(FELDER.map((f) => [f.key, f])) as Record<FeldKey, Feld>;

export const PERSOENLICH_SENSIBEL: FeldKey[] = ["geburtsdatum", "geschlecht", "telefon", "strasse", "hausnummer", "plz", "ort"];

function normal(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const NACHRANGIG = new Set(["anrede", "adresse", "anschrift", "status", "team", "garde", "mannschaft", "abteilung", "mitgliedschaft"]);
const SYNONYM = new Map<string, FeldKey>();
for (const f of FELDER) for (const s of f.synonyme) SYNONYM.set(normal(s), f.key);

// Automatische Zuordnung: nur exakte, eindeutige Spaltennamen. Jedes Feld hoechstens einmal.
export function automatischZuordnen(kopf: string[]): (FeldKey | null)[] {
  const n = kopf.map(normal);
  const hatVorname = n.some((k) => SYNONYM.get(k) === "vorname");
  const vergeben = new Set<FeldKey>();
  // Allgemeine Begriffe (z. B. „Anrede“, „Status“) nur, wenn es keine eindeutige Spalte fuer das Feld gibt
  const eindeutig = new Set(n.filter((k) => !NACHRANGIG.has(k)).map((k) => SYNONYM.get(k)).filter(Boolean));
  return n.map((k) => {
    let feld: FeldKey | null = SYNONYM.get(k) ?? null;
    if (feld && NACHRANGIG.has(k) && eindeutig.has(feld)) feld = null;
    // „Name“ neben „Vorname“ ist der Nachname, allein steht er fuer den vollen Namen
    if (k === "name") feld = hatVorname ? "nachname" : "name";
    if (!feld || vergeben.has(feld)) return null;
    vergeben.add(feld);
    return feld;
  });
}

// ── Werte aufbereiten ────────────────────────────────────────────────────────────────────────────────
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function emailNormal(w: string): string | null {
  const e = w.trim().toLowerCase().replace(/^mailto:/, "");
  return e.length <= 254 && EMAIL.test(e) ? e : null;
}

export function datumNormal(w: string, geburt = false): string | null {
  const t = w.trim();
  if (!t) return null;
  let j: number, m: number, d: number;
  let x: RegExpMatchArray | null;
  if ((x = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/))) [j, m, d] = [+x[1], +x[2], +x[3]];
  else if ((x = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s.*)?$/))) {
    [d, m, j] = [+x[1], +x[2], +x[3]];
    if (x[3].length === 2) {
      const jetzt = new Date().getFullYear() % 100;
      j += geburt ? (j > jetzt ? 1900 : 2000) : j > jetzt + 5 ? 1900 : 2000;
    }
  } else if (/^\d+(\.\d+)?$/.test(t)) return excelDatum(Number(t));
  else return null;
  const dat = new Date(Date.UTC(j, m - 1, d));
  if (dat.getUTCFullYear() !== j || dat.getUTCMonth() !== m - 1 || dat.getUTCDate() !== d) return null;
  if (j < 1900 || j > 2100) return null;
  return dat.toISOString().slice(0, 10);
}

export function geschlechtNormal(w: string): "weiblich" | "männlich" | "divers" | null {
  const t = normal(w);
  if (["w", "weiblich", "weibl", "f", "female", "frau", "fr", "maedchen", "madchen"].includes(t)) return "weiblich";
  if (["m", "maennlich", "mannlich", "maennl", "mannl", "male", "herr", "hr", "junge"].includes(t)) return "männlich";
  if (["d", "divers", "diverse", "x"].includes(t)) return "divers";
  return null;
}

// „Müller, Anna“ oder „Anna Müller“
export function nameTeilen(w: string): { vorname: string; nachname: string } | null {
  const t = w.trim().replace(/\s+/g, " ");
  if (!t) return null;
  if (t.includes(",")) {
    const [nach, vor] = t.split(",", 2).map((s) => s.trim());
    return vor && nach ? { vorname: vor, nachname: nach } : null;
  }
  const teile = t.split(" ");
  if (teile.length < 2) return null;
  return { vorname: teile.slice(0, -1).join(" "), nachname: teile[teile.length - 1] };
}

export type ImportZeile = {
  vorname: string;
  nachname: string;
  email?: string;
  geburtsdatum?: string;
  geschlecht?: string;
  telefon?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  mitgliedsnummer?: string;
  eintrittsdatum?: string;
  mitgliedsstatus?: string;
  gruppe?: string;
};

export type Hinweis = { zeile: number; text: string };

// Erzeugt aus den Rohzeilen nur die ausgewaehlten, zugeordneten Felder. Nicht ausgewaehlte Spalten werden
// hier verworfen und verlassen den Browser nie.
export function zeilenAufbereiten(
  zeilen: string[][],
  zuordnung: (FeldKey | null)[],
  auswahl: Set<FeldKey>,
): { daten: (ImportZeile & { quelle: number })[]; hinweise: Hinweis[] } {
  const daten: (ImportZeile & { quelle: number })[] = [];
  const hinweise: Hinweis[] = [];
  const spalte = (k: FeldKey) => (auswahl.has(k) ? zuordnung.indexOf(k) : -1);
  const idx = Object.fromEntries(FELDER.map((f) => [f.key, spalte(f.key)])) as Record<FeldKey, number>;
  const kurz = (w: string, max: number) => w.trim().slice(0, max);

  zeilen.forEach((z, i) => {
    const nr = i + 2; // Zeilennummer in der Datei (1 = Kopfzeile)
    const wert = (k: FeldKey) => (idx[k] >= 0 ? (z[idx[k]] ?? "").trim() : "");
    let vorname = wert("vorname");
    let nachname = wert("nachname");
    if ((!vorname || !nachname) && wert("name")) {
      const t = nameTeilen(wert("name"));
      if (t) {
        vorname ||= t.vorname;
        nachname ||= t.nachname;
      }
    }
    if (!vorname || !nachname) {
      if (z.some((w) => w.trim() !== "")) hinweise.push({ zeile: nr, text: "ohne Vor- oder Nachnamen – wird übersprungen" });
      return;
    }
    const d: ImportZeile & { quelle: number } = { vorname: kurz(vorname, 100), nachname: kurz(nachname, 100), quelle: i };
    const em = wert("email");
    if (em) {
      const e = emailNormal(em);
      if (e) d.email = e;
      else hinweise.push({ zeile: nr, text: `E-Mail „${em.slice(0, 60)}“ ist ungültig – wird nicht übernommen` });
    }
    for (const k of ["geburtsdatum", "eintrittsdatum"] as const) {
      const w = wert(k);
      if (!w) continue;
      const dat = datumNormal(w, k === "geburtsdatum");
      if (dat) d[k] = dat;
      else hinweise.push({ zeile: nr, text: `${FELD[k].label} „${w.slice(0, 30)}“ nicht erkannt – wird nicht übernommen` });
    }
    const g = wert("geschlecht");
    if (g) {
      const n = geschlechtNormal(g);
      if (n) d.geschlecht = n;
      else hinweise.push({ zeile: nr, text: `Geschlecht „${g.slice(0, 20)}“ nicht erkannt – wird nicht übernommen` });
    }
    const texte: [FeldKey & keyof ImportZeile, number][] = [
      ["telefon", 50],
      ["strasse", 150],
      ["hausnummer", 20],
      ["plz", 20],
      ["ort", 100],
      ["mitgliedsnummer", 50],
      ["mitgliedsstatus", 60],
      ["gruppe", 80],
    ];
    for (const [k, max] of texte) {
      const w = wert(k);
      if (w) (d as Record<string, unknown>)[k] = kurz(w, max);
    }
    daten.push(d);
  });
  return { daten, hinweise };
}

// Doppelte Eintraege innerhalb der Datei (gleiche E-Mail oder gleiche Mitgliedsnummer)
export function dateiDuplikate(daten: ImportZeile[]): Set<number> {
  const doppelt = new Set<number>();
  const emails = new Map<string, number>();
  const nummern = new Map<string, number>();
  daten.forEach((d, i) => {
    if (d.email) {
      if (emails.has(d.email)) doppelt.add(i);
      else emails.set(d.email, i);
    }
    if (d.mitgliedsnummer) {
      if (nummern.has(d.mitgliedsnummer)) doppelt.add(i);
      else nummern.set(d.mitgliedsnummer, i);
    }
  });
  return doppelt;
}
