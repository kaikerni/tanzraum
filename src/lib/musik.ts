// Musik: Vereinsmusik (Vereinsadmin/Trainer verwalten, zugeordnete Gruppen hoeren) und persoenliche Musik ab BASIC.
// Rechte: DB (darf_musik_verwalten, musik_hoerbar, RLS auf musik_titel und Bucket "musik").

export const MUSIK_BUCKET = "musik";
export const MUSIK_MAX = 30 * 1024 * 1024;

export type MusikArt = "training" | "auftritt" | "einlauf" | "sonstiges";
export const MUSIK_ART_LABEL: Record<MusikArt, string> = { training: "Training", auftritt: "Auftritt / Turnier", einlauf: "Ein-/Ausmarsch", sonstiges: "Sonstiges" };
export const MUSIK_ARTEN = Object.keys(MUSIK_ART_LABEL) as MusikArt[];

export type MusikTitel = {
  id: string;
  verein_id: string | null;
  user_id: string | null;
  titel: string;
  interpret: string | null;
  art: MusikArt;
  gruppen: string[];
  bpm: number | null;
  notiz: string | null;
  datei_pfad: string;
  datei_name: string | null;
  groesse_bytes: number;
  mime_type: string | null;
  erstellt_am: string;
};

export const MUSIK_SPALTEN = "id, verein_id, user_id, titel, interpret, art, gruppen, bpm, notiz, datei_pfad, datei_name, groesse_bytes, mime_type, erstellt_am";

export function mb(bytes: number): string {
  return bytes >= 1024 * 1024 * 1024 ? `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace(".", ",")} GB` : `${Math.max(0.1, bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
