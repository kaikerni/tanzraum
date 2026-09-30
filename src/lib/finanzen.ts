// Finanzen (Vereinslizenz): Kassenbuch, Belege, Beitragsarten, Beitraege. Rechte: DB (darf_finanzen, RLS).

export const BELEG_BUCKET = "kassenbuch-belege";
export const BELEG_MAX = 10 * 1024 * 1024;

export const KATEGORIEN_EINNAHME = ["Mitgliedsbeiträge", "Startgelder", "Spenden", "Zuschüsse", "Veranstaltungen", "Kostüme", "Sonstiges"];
export const KATEGORIEN_AUSGABE = ["Hallenmiete", "Trainer", "Startgebühren", "Kostüme", "Fahrtkosten", "Verband", "Versicherung", "Veranstaltungen", "Material", "Sonstiges"];
export const ZAHLUNGSARTEN = ["Überweisung", "Bar", "Lastschrift", "Karte", "PayPal"];
export const RHYTHMEN = ["monatlich", "vierteljährlich", "halbjährlich", "jährlich", "einmalig"] as const;

export type Buchung = {
  id: string;
  verein_id: string;
  datum: string;
  typ: "einnahme" | "ausgabe";
  kategorie: string | null;
  betrag: number;
  beschreibung: string | null;
  zahlungsart: string | null;
  beleg_pfad: string | null;
  beleg_name: string | null;
  beitrag_id: string | null;
};
export const BUCHUNG_SPALTEN = "id, verein_id, datum, typ, kategorie, betrag, beschreibung, zahlungsart, beleg_pfad, beleg_name, beitrag_id";

export type Beitragsart = { id: string; name: string; betrag: number; rhythmus: string; aktiv: boolean };
export type Beitrag = {
  id: string;
  vereins_mitglied_id: string;
  beitragstyp_id: string | null;
  beitragstyp_name: string;
  betrag: number;
  faellig: string | null;
  bezahlt: boolean;
  bezahlt_am: string | null;
  zahlungsweg: string;
  notiz: string | null;
  erinnert_am: string | null;
};
export const BEITRAG_SPALTEN = "id, vereins_mitglied_id, beitragstyp_id, beitragstyp_name, betrag, faellig, bezahlt, bezahlt_am, zahlungsweg, notiz, erinnert_am";

export function euro(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export function betragLesen(s: string): number {
  const t = String(s ?? "").trim().replace(/\s|€/g, "");
  // 1.234,56 -> 1234.56 ; 1234.56 bleibt
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export function heuteBerlin(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

export function datumDe(d: string | null): string {
  return d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE") : "–";
}
