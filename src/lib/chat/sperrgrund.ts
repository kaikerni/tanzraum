// Texte zu schreib_sperrgrund() / chat_kopf.sperrgrund (die Pruefung selbst passiert in der Datenbank)
export const SPERRGRUND_TEXT: Record<string, string> = {
  blockiert: "Du kannst dieser Person nicht schreiben.",
  eltern_sperre_ich: "Deine Eltern haben Nachrichten für dein Konto deaktiviert. Du kannst nur noch mit ihnen schreiben.",
  // betrifft nur die eigene Person – Gruende der anderen Person (Alter, Elternsperre) werden nicht verraten
  jugendschutz: "Unter 16 Jahren kannst du mit Mitgliedern deines Vereins und deinen Eltern schreiben.",
  kontakt_noetig: "Ihr seid nicht im selben Verein. Vernetzt euch zuerst – nach der Annahme könnt ihr schreiben.",
  tarif_ich: "Nachrichten gibt es ab dem Basic-Tarif. Mit Free kannst du Kontaktanfragen senden und annehmen.",
  tarif_partner: "Diese Person kann mit ihrem Tarif keine Nachrichten empfangen – eure Vernetzung bleibt bestehen.",
  nur_leitung: "Hier schreiben nur Vorstand, Trainer und Betreuer.",
  nicht_moeglich: "Eine Kontaktaufnahme mit dieser Person ist nicht möglich.",
};

export function sperrgrundText(grund: string | null | undefined): string {
  return SPERRGRUND_TEXT[grund ?? ""] ?? SPERRGRUND_TEXT.nicht_moeglich;
}
