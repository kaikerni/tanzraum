import type { SupabaseClient } from "@supabase/supabase-js";

// TanzRaum Boerse – Community-Marktplatz fuer alle (FREE, BASIC, VEREIN); Rechte prueft die Datenbank.
export type BoerseArt = "verkaufen" | "tauschen" | "verschenken" | "suchen";
export type BoerseStatus = "aktiv" | "pausiert" | "reserviert" | "verkauft" | "verschenkt" | "getauscht" | "beendet" | "gesperrt";
export type Zustand = "neu" | "wie_neu" | "sehr_gut" | "gut" | "gebraucht" | "defekt";

export type Kategorie = { schluessel: string; eltern: string | null; name: string; emoji: string | null; sortierung: number };

export type Angebot = {
  id: string;
  art: BoerseArt;
  kategorie: string;
  unterkategorie: string | null;
  titel: string;
  preis_cent: number | null;
  preis_vb: boolean;
  zustand: Zustand | null;
  groesse: string | null;
  ort: string | null;
  versand: boolean;
  abholung: boolean;
  tausch_moeglich: boolean;
  bilder: string[];
  status: BoerseStatus;
  erstellt_am: string;
  aktualisiert_am: string;
  ist_meins: boolean;
  favorit: boolean;
  km?: number | null;
  verfuegbar?: boolean;
  kontakte?: number;
  // Detail
  beschreibung?: string | null;
  sperrgrund?: string | null;
  anbieter?: { id: string; name: string; seit: string | null; angebote: number };
  favoriten?: number;
  kontaktierbar?: boolean;
  mein_status?: string | null;
};

export const ART_LABEL: Record<BoerseArt, string> = {
  verkaufen: "Verkaufen",
  tauschen: "Tauschen",
  verschenken: "Verschenken",
  suchen: "Suche",
};

export const ART_STIL: Record<BoerseArt, string> = {
  verkaufen: "bg-brand-ink text-white",
  tauschen: "bg-brand-gold text-brand-ink",
  verschenken: "bg-brand-green text-white",
  suchen: "bg-brand-red text-white",
};

export const ZUSTAND_LABEL: Record<Zustand, string> = {
  neu: "Neu",
  wie_neu: "Wie neu",
  sehr_gut: "Sehr gut",
  gut: "Gut",
  gebraucht: "Gebraucht",
  defekt: "Defekt / Bastler",
};

export const STATUS_LABEL: Record<BoerseStatus, string> = {
  aktiv: "Aktiv",
  pausiert: "Pausiert",
  reserviert: "Reserviert",
  verkauft: "Verkauft",
  verschenkt: "Verschenkt",
  getauscht: "Getauscht",
  beendet: "Beendet",
  gesperrt: "Von der Moderation deaktiviert",
};

export const MELDEGRUENDE: [string, string][] = [
  ["unangemessen", "Unangemessener Inhalt"],
  ["falsche_angaben", "Falsche Angaben"],
  ["spam", "Spam"],
  ["betrug", "Betrugsverdacht"],
  ["verboten", "Verbotenes Angebot"],
  ["sonstiges", "Sonstiger Verstoß"],
];

export function preisText(a: Pick<Angebot, "art" | "preis_cent" | "preis_vb">): string {
  if (a.art === "verschenken") return "Zu verschenken";
  if (a.art === "tauschen") return "Zum Tausch";
  if (a.art === "suchen") return a.preis_cent != null && a.preis_cent > 0 ? `bis ${euro(a.preis_cent)}` : "Gesucht";
  if (a.preis_cent == null) return "Preis auf Anfrage";
  if (a.preis_cent === 0) return "Kostenlos";
  return `${euro(a.preis_cent)}${a.preis_vb ? " VB" : ""}`;
}

export const euro = (cent: number) =>
  (cent / 100).toLocaleString("de-DE", { minimumFractionDigits: cent % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }) + " €";

export function seitText(iso: string): string {
  const tage = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 30) return `vor ${tage} Tagen`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

export async function getKategorien(supabase: SupabaseClient): Promise<Kategorie[]> {
  const { data } = await supabase.from("boerse_kategorien").select("schluessel, eltern, name, emoji, sortierung").order("sortierung");
  return (data ?? []) as Kategorie[];
}

// Bilder liegen im privaten Bucket "boerse"; Anzeige ueber kurzlebige signierte Links (Zugriff prueft die Storage-RLS)
export async function bilderSignieren(supabase: SupabaseClient, pfade: string[]): Promise<Map<string, string>> {
  const eindeutig = [...new Set(pfade.filter(Boolean))];
  const karte = new Map<string, string>();
  if (eindeutig.length === 0) return karte;
  const { data } = await supabase.storage.from("boerse").createSignedUrls(eindeutig, 3600);
  for (const e of data ?? []) if (e.path && e.signedUrl) karte.set(e.path, e.signedUrl);
  return karte;
}
