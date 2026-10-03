// E-Mail-Vorlage fuer die beantragte Kontoloeschung. Layout und Versand: ../_shared/mail.ts
import { esc, layout } from "../_shared/mail.ts";

export function kontoLoeschungBestaetigt(p: { vorname: string; loeschenAb: string; link: string }): { betreff: string; html: string } {
  return {
    betreff: "TanzRaum – Löschung deines Kontos beantragt",
    html: layout({
      vorschau: `Dein TanzRaum-Konto wird am ${p.loeschenAb} endgültig gelöscht.`,
      titel: "Löschung deines Kontos beantragt",
      absaetze: [
        `Hallo ${esc(p.vorname || "")},`.replace(" ,", ","),
        `du hast die Löschung deines TanzRaum-Kontos beantragt. Dein Konto ist ab sofort gesperrt und wird am <strong>${esc(p.loeschenAb)}</strong> endgültig gelöscht.`,
        "Chatnachrichten, die du an andere geschickt hast, bleiben in deren Verläufen erhalten – als Absender wird „Gelöschtes Konto“ angezeigt. Rechnungen bleiben wegen der gesetzlichen Aufbewahrungspflicht erhalten.",
      ],
      button: { text: "Löschung widerrufen", url: p.link },
      nachButton: ["Hast du es dir anders überlegt? Über den Button kannst du die Löschung bis zu diesem Zeitpunkt widerrufen – dein Konto ist danach sofort wieder nutzbar."],
      hinweis: "Du hast die Löschung nicht beantragt? Dann widerrufe sie über den Button und ändere anschließend dein Passwort.",
    }),
  };
}
