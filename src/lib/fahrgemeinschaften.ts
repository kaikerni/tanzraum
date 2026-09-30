import type { SupabaseClient } from "@supabase/supabase-js";

// Fahrgemeinschaften: nur innerhalb des eigenen Vereins mit Vereinslizenz (Pruefung in der Datenbank)
export type FahrtArt = "angebot" | "gesuch";
export type Richtung = "hin" | "rueck" | "hin_rueck";
export type FahrtStatus = "offen" | "erledigt" | "abgesagt";
export type ReaktionArt = "mitfahren" | "anbieten" | "nachricht";

export type Reaktion = {
  id: string;
  art: ReaktionArt;
  personen: number;
  text: string | null;
  erstellt_am: string;
  user_id: string;
  name: string;
  ist_meine: boolean;
};

export type Fahrt = {
  id: string;
  art: FahrtArt;
  anlass: string;
  ziel: string | null;
  datum: string;
  uhrzeit: string | null;
  treffpunkt: string | null;
  richtung: Richtung;
  plaetze: number;
  notiz: string | null;
  status: FahrtStatus;
  erstellt_am: string;
  ersteller: { id: string; name: string };
  ist_meine: boolean;
  belegt: number;
  angeboten: number;
  antworten: Reaktion[];
};

export type FahrtenUebersicht =
  | { zugang: false; grund: "kein_verein" | "keine_lizenz" | "bereich_aus" }
  | { zugang: true; verein_id: string; verein_name: string; ich: string; darf_schreiben: boolean; fahrten: Fahrt[] };

export const RICHTUNG_LABEL: Record<Richtung, string> = { hin: "nur Hinfahrt", rueck: "nur Rückfahrt", hin_rueck: "Hin- und Rückfahrt" };

export async function getFahrten(supabase: SupabaseClient, vergangene = false): Promise<FahrtenUebersicht | null> {
  const { data, error } = await supabase.rpc("fahrgemeinschaften_uebersicht", { p_vergangene: vergangene });
  if (error || !data) return null;
  return data as FahrtenUebersicht;
}

export function fahrtDatum(datum: string, lang = true): string {
  return new Date(`${datum}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: lang ? "long" : "short",
    day: "2-digit",
    month: "2-digit",
    ...(lang ? { year: "numeric" } : {}),
    timeZone: "Europe/Berlin",
  });
}

export function initialen(name: string): string {
  const teile = name.trim().split(/\s+/);
  return ((teile[0]?.[0] ?? "") + (teile.length > 1 ? (teile[teile.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}
