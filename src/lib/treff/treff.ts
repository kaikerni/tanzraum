// 💬 TanzRaum Treff: Typen und Anzeige-Helfer. Rechte (lesen ab FREE, schreiben ab BASIC/VEREIN, Moderation nur
// TanzRaum-Admin/Team mit Recht) prueft die Datenbank.

export type Autor = { user_id: string; handle: string | null; avatar_url: string | null; verein: string | null; kennzeichen: string | null };

export type ThemaListe = {
  id: string;
  kategorie_id: string;
  kategorie: string;
  kategorie_emoji: string | null;
  titel: string;
  auszug: string;
  autor_id: string | null;
  autor_handle: string | null;
  autor_avatar: string | null;
  autor_verein: string | null;
  autor_kennzeichen: string | null;
  erstellt_am: string;
  bearbeitet_am: string | null;
  letzte_aktivitaet: string;
  antworten: number;
  angepinnt: boolean;
  geschlossen: boolean;
  empfohlen: boolean;
  beantwortet: boolean;
};

export type Beitrag = {
  id: string;
  inhalt: string;
  bild_pfad: string | null;
  erstellt_am: string;
  bearbeitet_am: string | null;
  empfohlen: boolean;
  ich_autor: boolean;
  autor: Autor | null;
  hilfreich: number;
  ich_hilfreich: boolean;
};

export type ThemaDetail = {
  id: string;
  titel: string;
  inhalt: string;
  link: string | null;
  bild_pfad: string | null;
  datei_pfad: string | null;
  datei_name: string | null;
  erstellt_am: string;
  bearbeitet_am: string | null;
  letzte_aktivitaet: string;
  antworten: number;
  angepinnt: boolean;
  geschlossen: boolean;
  empfohlen: boolean;
  beste_antwort_id: string | null;
  kategorie_id: string;
  kategorie: { name: string; emoji: string | null } | null;
  autor: Autor | null;
  ich_autor: boolean;
  ich_folge: boolean;
  darf_schreiben: boolean;
  wissen: { id: string; titel: string }[] | null;
  beitraege: Beitrag[];
};

export type Kategorie = { id: string; name: string; emoji: string | null; beschreibung: string | null; sortierung: number; aktiv: boolean; themen: number; letzte_aktivitaet: string | null };

export type TreffStatus = { schreiben: boolean; tarif: string; unter_16: boolean; gesperrt_bis: string | null; themen_erstellen_team: boolean; admin: boolean; rechte: string[] };

// „Neues Thema“ nur anzeigen, wenn es auch erlaubt ist (die Datenbank prueft beim Speichern erneut)
export const darfThemaErstellen = (s: TreffStatus) => s.schreiben || (s.themen_erstellen_team && !s.unter_16 && !s.gesperrt_bis);

export const MELDEGRUENDE: { id: string; label: string }[] = [
  { id: "spam", label: "Spam" },
  { id: "beleidigung", label: "Beleidigung" },
  { id: "unangemessen", label: "Unangemessener Inhalt" },
  { id: "werbung", label: "Werbung" },
  { id: "problematisch", label: "Problematischer Inhalt" },
  { id: "jugendgefaehrdend", label: "Jugendschutz" },
  { id: "sonstiges", label: "Sonstiges" },
];
export const GRUND_LABEL: Record<string, string> = Object.fromEntries(MELDEGRUENDE.map((g) => [g.id, g.label]));

export const MELDESTATUS: Record<string, string> = { offen: "Offen", in_pruefung: "In Prüfung", erledigt: "Erledigt", keine_massnahme: "Keine Maßnahme" };

export function zeitRelativ(iso: string, jetzt = new Date()): string {
  const s = Math.round((jetzt.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "gerade eben";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  if (s < 7 * 86400) return `vor ${Math.floor(s / 86400)} Tag${Math.floor(s / 86400) === 1 ? "" : "en"}`;
  return new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
}

// „bearbeitet“, wenn mehr als eine Minute nach dem Erstellen geaendert
export const istBearbeitet = (erstellt: string, bearbeitet: string | null) => !!bearbeitet && new Date(bearbeitet).getTime() - new Date(erstellt).getTime() > 60_000;
