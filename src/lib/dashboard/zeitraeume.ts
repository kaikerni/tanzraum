// Auswaehlbare Zeitraeume (Wochen) fuer die Trainingsbeteiligung im Dashboard.
// Eigene Datei ohne "use client": Die Dashboard-Seite (Server) und die Auswahl (Client) nutzen dieselbe Liste.
// Werte aus einer "use client"-Datei sind in Server-Code nur Verweise (dort kein Array -> ".find is not a function").
export const ZEITRAEUME = [4, 8, 12] as const;
