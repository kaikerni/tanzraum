// Kai – der TanzRaum-Begleiter: gemeinsame Typen.
// Kai ist KEINE KI. Er zeigt nur fest hinterlegte Texte (src/lib/kai/inhalte.ts) und Links;
// er liest keine fremden Daten, aendert nichts, verschickt nichts und entscheidet nichts.

export type KaiVariante = "welcome" | "help" | "info" | "success" | "warning" | "point" | "setup";

// Posen (Bilder) – vorerst zeigen alle auf das Masterbild; einzeln austauschbar in src/lib/kai/posen.ts
export type KaiPose = "begruessung" | "erklaeren" | "hinweis" | "idee" | "erfolg" | "warnung" | "sport" | "nachdenken";

// Link, den Kai anbietet – ausgeloest wird er immer von der Person selbst
export type KaiAktion = { label: string; href: string };

// Wer gerade mit Kai spricht (nur Anzeige-Angaben aus dem Layout, keine zusaetzlichen Datenabfragen)
export type KaiKontext = {
  vorname: string;
  istPlattformAdmin: boolean;
  hatVerein: boolean;
  istVereinsadmin: boolean;
  tarif: "free" | "basic" | "verein";
  // Bereiche, die diese Person im Menue hat – Kai verweist nur dorthin (Links auf andere Ziele werden ausgeblendet)
  bereiche: string[];
  // „Ansicht als …“ der Administration: Kai zeigt dann die Sicht der gewaehlten Rolle
  vorschau: boolean;
  // Updates & Neuigkeiten der TanzRaum-Administration mit „Kai-Hinweis“ (zentrale Quelle, siehe docs/updates-versionen.md)
  neuigkeiten?: KaiNeuigkeit[];
};

// Ein Schritt der Einrichtungshilfe
export type KaiSchritt = {
  id: string;
  titel: string;
  text: string;
  aktion?: KaiAktion;
  // automatisch erledigt (z. B. Verein bereits vorhanden)
  erledigt?: boolean;
};

// Tipp passend zur aktuellen Seite: kurze Zeile in Kais Sprechblase, darunter Erklaerung und ggf. Schritte
export type KaiTipp = {
  pfad: string;
  exakt?: boolean;
  zeile: string;
  titel: string;
  text: string;
  schritte?: string[];
  aktion?: KaiAktion;
  pose?: KaiPose;
};

// „Frag Kai“: feste Fragen und Antworten (keine KI, keine Schnittstelle) – Treffer ueber Suchwoerter
// bereiche: Routen, auf denen Kai diese Frage direkt als Hilfethema anbietet (Praefix, z. B. "/dashboard/kalender")
// oeffentlich: Thema fuer nicht angemeldete Besucher (Anmeldung/Registrierung) – nur allgemeine Infos, keine Vereins- oder Kontodaten.
// Oeffentliche Themen erscheinen nur dort, interne Themen nie auf den oeffentlichen Seiten.
export type KaiFrage = { id: string; frage: string; stichworte: string[]; antwort: string; schritte?: string[]; aktion?: KaiAktion; bereiche?: string[]; oeffentlich?: boolean };

// Hinweis auf eine neue Funktion (id bleibt fest, damit „gelesen“ auf dem Geraet gemerkt werden kann)
// wichtig: Kai bietet dafuer proaktiv einen Hinweis an (roter Punkt am „Kai – Hilfe?“-Knopf) – er oeffnet sich nie von selbst
export type KaiNeuigkeit = { id: string; datum: string; titel: string; text: string; aktion?: KaiAktion; wichtig?: boolean };
