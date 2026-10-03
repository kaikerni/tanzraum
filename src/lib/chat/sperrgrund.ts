// Texte zu schreib_sperrgrund() / chat_kopf.sperrgrund (die Pruefung selbst passiert in der Datenbank)
export const SPERRGRUND_TEXT: Record<string, string> = {
  blockiert: "Du kannst dieser Person nicht schreiben.",
  eltern_sperre_ich: "Deine Eltern haben Nachrichten für dein Konto deaktiviert. Du kannst nur noch mit ihnen schreiben.",
  // betrifft nur die eigene Person – Gruende der anderen Person (Alter, Elternsperre) werden nicht verraten
  jugendschutz: "Unter 16 Jahren kannst du mit Mitgliedern deines Vereins und deinen Eltern schreiben.",
  kontakt_noetig: "Ihr seid nicht im selben Verein. Werdet zuerst Buddys – nach der Annahme könnt ihr schreiben.",
  privat_konto: "Dieses Konto ist privat. Schreiben können Mitglieder desselben Vereins und Buddys (Buddys ab BASIC).",
  tarif_ich: "Privaten Konten kannst du als Buddy schreiben – Buddys gibt es ab BASIC.",
  tarif_partner: "Diese Person nutzt derzeit keinen Tarif mit Buddys – ihr privates Konto ist deshalb gerade nicht erreichbar.",
  nur_leitung: "Hier schreiben nur Vorstand, Trainer und Betreuer.",
  nicht_moeglich: "Eine Kontaktaufnahme mit dieser Person ist nicht möglich.",
  chat_gesperrt: "Du kannst hier gerade nicht schreiben, weil mehrere Nachrichten gegen die Chatregeln verstoßen haben. Lesen kannst du weiterhin.",
  chat_ab_16: "Im TanzRaum Chat kannst du ab 16 Jahren mitschreiben. Lesen kannst du schon jetzt.",
};

export function sperrgrundText(grund: string | null | undefined): string {
  return SPERRGRUND_TEXT[grund ?? ""] ?? SPERRGRUND_TEXT.nicht_moeglich;
}
