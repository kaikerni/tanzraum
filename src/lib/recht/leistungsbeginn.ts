// Ausdrueckliches Verlangen des vorzeitigen Leistungsbeginns (Widerrufsrecht, Wertersatz) vor dem Kauf.
// Der Text wird serverseitig (Edge Function zahlung-starten) mit Version im Einwilligungsnachweis gespeichert
// und muss dort identisch sein (supabase/functions/_shared/zahlung.ts, geprueft in zahlung-tests.test.ts).
export const LEISTUNGSBEGINN_VERSION = "27.09.2026";
export const LEISTUNGSBEGINN_TEXT =
  "Ich verlange ausdrücklich, dass TanzRaum vor Ablauf der Widerrufsfrist mit der Leistung beginnt. Mir ist bekannt, dass ich bei einem Widerruf einen angemessenen Betrag (Wertersatz) für die bis dahin erbrachte Leistung zahlen muss.";
