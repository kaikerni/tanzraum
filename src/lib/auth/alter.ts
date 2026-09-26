// Zentrale Altersgrenzen von TanzRaum. Die verbindliche Pruefung erfolgt serverseitig in der Datenbank
// (ist_unter_16, datum_unter_16, ist_volljaehrig); diese Werte dienen nur Anzeige und Formularfuehrung.
//
//   unter 16  -> Kinderkonto: Zustimmung eines Elternteils, Schutzvoreinstellungen
//   ab 16     -> eigenes Konto
//   ab 18     -> nur fuer Elternteile (Volljaehrigkeit bei Zustimmung/Verknuepfung)
export const KINDERKONTO_BIS = 16;
export const VOLLJAEHRIG_AB = 18;

// Alter in ganzen Jahren am Tag `heute` (beide als JJJJ-MM-TT, Europe/Berlin)
export function alterAm(geburtsdatum: string, heute: string): number {
  const [gj, gm, gt] = geburtsdatum.split("-").map(Number);
  const [hj, hm, ht] = heute.split("-").map(Number);
  return hj - gj - (hm < gm || (hm === gm && ht < gt) ? 1 : 0);
}

export function heuteInBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function istKinderkontoAlter(geburtsdatum: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(geburtsdatum) && alterAm(geburtsdatum, heuteInBerlin()) < KINDERKONTO_BIS;
}

// Version der Zustimmungstexte – muss mit public.zustimmung_textversion() uebereinstimmen (die Datenbank prueft).
export const ZUSTIMMUNG_TEXTVERSION = "eltern-zustimmung-v1 | datenschutz 26.09.2026 | nutzungsbedingungen 26.09.2026";
