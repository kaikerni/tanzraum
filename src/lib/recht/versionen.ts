// Aktuelle Fassungen der Rechtstexte. Muss mit dem Register rechtstext_versionen in der Datenbank uebereinstimmen
// (neue Fassung: Text aendern, Version hier erhoehen und per Migration in rechtstext_versionen eintragen).
// Registrierung und "Zustimmung nachholen" pruefen serverseitig, dass genau diese Fassung aktuell ist.
export const RECHTSTEXT_VERSION = {
  nutzungsbedingungen: "30.09.2026",
  datenschutz: "30.09.2026",
} as const;
