export type WissenArtikel = {
  id: string;
  titel: string;
  kategorie_id: string | null;
  einleitung: string | null;
  inhalt: string;
  bild_pfad: string | null;
  link: string | null;
  redaktionshinweis: string | null;
  treff_thema_id: string | null;
  status: string;
  erstellt_am: string;
  geaendert_am: string;
  veroeffentlicht_am: string | null;
};

export const WISSEN_SPALTEN = "id, titel, kategorie_id, einleitung, inhalt, bild_pfad, link, redaktionshinweis, treff_thema_id, status, erstellt_am, geaendert_am, veroeffentlicht_am";
