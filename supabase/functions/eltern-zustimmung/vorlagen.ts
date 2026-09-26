// E-Mail-Vorlagen fuer Kinderkonten unter 16 (Zustimmung eines Elternteils bzw. Traegers der elterlichen Verantwortung).
// Layout und Versand: ../_shared/mail.ts
import { esc, layout } from "../_shared/mail.ts";

export type Mail = { betreff: string; html: string };

export function elternZustimmungAnfrage(p: { kindVorname: string; link: string; gueltigBis: string }): Mail {
  const kind = esc(p.kindVorname || "Dein Kind");
  return {
    betreff: `TanzRaum – ${p.kindVorname || "Dein Kind"} bittet um deine Zustimmung`,
    html: layout({
      vorschau: `${p.kindVorname || "Dein Kind"} möchte TanzRaum nutzen und braucht dafür deine Zustimmung.`,
      titel: "Zustimmung für ein Kinderkonto",
      absaetze: [
        "Hallo,",
        `<strong>${kind}</strong> hat sich bei TanzRaum registriert – der Plattform für den karnevalistischen Tanzsport – und diese E-Mail-Adresse als Adresse eines Elternteils angegeben.`,
        "Für Kinder unter 16 Jahren wird das Konto erst freigeschaltet, wenn ein Elternteil bzw. Träger der elterlichen Verantwortung zustimmt. Bis dahin kann das Konto nicht genutzt werden. Für die Zustimmung brauchst du kein eigenes TanzRaum-Konto.",
      ],
      button: { text: "Anfrage ansehen und entscheiden", url: p.link },
      nachButton: [
        "Auf der Seite siehst du, welche Angaben dein Kind gemacht hat und welche Schutzeinstellungen für Kinderkonten gelten. Du kannst zustimmen oder ablehnen.",
      ],
      hinweis: `Du kennst ${kind} nicht oder bist nicht Elternteil? Dann lehne über den Link ab oder ignoriere diese E-Mail – ohne Zustimmung wird ein neu angelegtes Konto nach 14 Tagen automatisch gelöscht. Der Link ist bis ${esc(p.gueltigBis)} gültig und kann nur einmal verwendet werden.`,
    }),
  };
}

export function elternZustimmungBestaetigt(p: { kindVorname: string; datum: string; push: boolean; link: string }): Mail {
  const kind = esc(p.kindVorname || "deines Kindes");
  return {
    betreff: "TanzRaum – deine Zustimmung wurde gespeichert",
    html: layout({
      vorschau: `Das TanzRaum-Konto von ${p.kindVorname || "deinem Kind"} ist freigeschaltet.`,
      titel: "Danke – das Kinderkonto ist freigeschaltet",
      absaetze: [
        "Hallo,",
        `du hast am ${esc(p.datum)} der Nutzung des TanzRaum-Kinderkontos von <strong>${kind}</strong> zugestimmt. Push-Benachrichtigungen: ${p.push ? "erlaubt" : "nicht erlaubt"}.`,
        "Für Kinderkonten gelten Schutzvoreinstellungen: keine Anzeige auf der TanzRaum Map, Spotlights nur für Verein und Kontakte, Nachrichten nur mit dem eigenen Verein und den Eltern.",
        "Mit einem eigenen TanzRaum-Konto kannst du dich mit dem Kinderkonto verknüpfen und diese Einstellungen selbst verwalten. Melde dich dafür mit dieser E-Mail-Adresse an oder registriere dich neu.",
      ],
      button: { text: "Elternkonto verknüpfen", url: p.link },
      hinweis: "Du hast nicht zugestimmt oder möchtest deine Zustimmung widerrufen? Schreib uns an info@tanzraum.app. Der Link zum Verknüpfen ist 30 Tage gültig und kann nur einmal verwendet werden.",
    }),
  };
}
