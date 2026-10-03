import type { SupabaseClient } from "@supabase/supabase-js";

// Zentrale Speicherkontingente: Werte stehen in der Datenbank (speicher_kontingente, plattform_einstellungen.speicher_gesamt_mb).
// Einheit ueberall MB (1 MB = 1024 * 1024 Byte). Hier nur Anzeige und Vorpruefung – die Grenzen setzt die Datenbank.

export const MB = 1024 * 1024;

export type SpeicherKategorie = {
  schluessel: string;
  bezeichnung: string;
  beschreibung: string | null;
  bezug: "person" | "verein";
  pruefung: "reservierung" | "storage";
  buckets: string[];
  limitMb: number;
  aktiv: boolean;
  belegt: number;
  dateien: number;
  geaendertAm: string | null;
};

export type SpeicherUebersicht = {
  gesamtMb: number;
  technischMb: number | null;
  belegt: number;
  dateien: number;
  nutzer: number;
  vereine: number;
  sonstige: number;
  kategorien: SpeicherKategorie[];
  topVereine: { name: string; belegt: number }[];
  topNutzer: { name: string; belegt: number }[];
};

// 980 KB · 98 MB · 1,2 GB (wie speicher_groesse_text in der Datenbank)
export function speicherText(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  if (bytes >= 1024 * MB) return `${(bytes / 1024 / MB).toLocaleString("de-DE", { maximumFractionDigits: 1 })} GB`;
  if (bytes >= MB) return `${(bytes / MB).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Eingabe in MB lesbar: 500 MB · 1 GB · 2,5 GB
export function mbText(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("de-DE", { maximumFractionDigits: 2 })} GB`;
  return `${mb.toLocaleString("de-DE")} MB`;
}

// Warnstufe des freigegebenen Gesamtspeichers: 80 % Hinweis, 90 % Warnung, 95 % deutlich, 100 % keine neuen Uploads
export function speicherStufe(prozent: number): { stufe: 0 | 80 | 90 | 95 | 100; text: string | null } {
  if (prozent >= 100) return { stufe: 100, text: "TanzRaum-Speicher ist voll – neue Uploads sind gesperrt, bestehende Dateien bleiben erhalten." };
  if (prozent >= 95) return { stufe: 95, text: `TanzRaum-Speicher ist zu ${Math.floor(prozent)} % belegt – bitte jetzt erweitern.` };
  if (prozent >= 90) return { stufe: 90, text: `TanzRaum-Speicher ist zu ${Math.floor(prozent)} % belegt.` };
  if (prozent >= 80) return { stufe: 80, text: `Hinweis: TanzRaum-Speicher ist zu ${Math.floor(prozent)} % belegt.` };
  return { stufe: 0, text: null };
}

// Genaue Vorpruefung vor einem direkten Upload (verstaendliche Meldung). Verbindlich prueft die Speicherregel der Datenbank.
export async function speicherVorpruefung(supabase: SupabaseClient, bucket: string, pfad: string, groesse: number): Promise<string | null> {
  const { error } = await supabase.rpc("speicher_vorpruefung", { p_bucket: bucket, p_pfad: pfad, p_groesse: Math.max(0, Math.floor(groesse)) });
  if (!error) return null;
  // Nur unsere eigenen Meldungen anzeigen; technische Fehler blockieren nicht (die Datenbank prueft beim Hochladen ohnehin)
  return error.code === "P0001" ? error.message : null;
}

// Oeffentliche Kontingentwerte (Tarifseite, Hinweise) in MB je Schluessel
export async function speicherKontingente(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data } = await supabase.rpc("speicher_kontingente_oeffentlich");
  const werte: Record<string, number> = {};
  for (const k of (data ?? []) as { schluessel: string; limit_mb: number }[]) werte[k.schluessel] = k.limit_mb;
  return werte;
}
