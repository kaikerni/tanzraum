// TanzRaum E-Mail-Vorlagen (Inhalt + Betreff). Layout und Versand: ./mail.ts
import { esc, layout } from "./mail.ts";

export type Mail = { betreff: string; html: string };

const hallo = (vorname?: string | null) => (vorname && vorname.trim() ? `Hallo ${esc(vorname.trim())},` : "Hallo,");
const GUELTIG = "Aus Sicherheitsgründen ist der Link nur begrenzte Zeit gültig (in der Regel 60 Minuten) und kann nur einmal verwendet werden.";

export function registrierung(p: { vorname?: string | null; link: string }): Mail {
  return {
    betreff: "Willkommen bei TanzRaum – bitte E-Mail-Adresse bestätigen",
    html: layout({
      vorschau: "Nur noch ein Klick: Bestätige deine E-Mail-Adresse und leg los.",
      titel: "Willkommen bei TanzRaum! 💃🕺",
      absaetze: [
        hallo(p.vorname),
        "schön, dass du dabei bist! TanzRaum verbindet Tänzerinnen und Tänzer, Trainer, Eltern und Vereine im karnevalistischen Tanzsport – Training, Termine, Turniere und der TanzRaum-Messenger an einem Ort.",
        "Bitte bestätige kurz deine E-Mail-Adresse. So stellen wir sicher, dass wirklich du dieses Konto angelegt hast und wir dich zum Beispiel beim Zurücksetzen deines Passworts erreichen können.",
      ],
      button: { text: "E-Mail-Adresse bestätigen", url: p.link },
      hinweis: `Du hast dich nicht bei TanzRaum registriert? Dann kannst du diese E-Mail einfach ignorieren – ohne Bestätigung wird kein Konto aktiviert. ${GUELTIG}`,
    }),
  };
}

export function passwortZuruecksetzen(p: { vorname?: string | null; link: string }): Mail {
  return {
    betreff: "TanzRaum – Passwort zurücksetzen",
    html: layout({
      vorschau: "Setze jetzt ein neues Passwort für dein TanzRaum-Konto.",
      titel: "Passwort zurücksetzen",
      absaetze: [hallo(p.vorname), "wir haben eine Anfrage erhalten, das Passwort für dein TanzRaum-Konto zurückzusetzen. Klicke auf den Button, um ein neues Passwort festzulegen."],
      button: { text: "Passwort zurücksetzen", url: p.link },
      hinweis: `<strong>Sicherheitshinweis:</strong> Du hast das nicht angefordert? Dann ignoriere diese E-Mail – dein bisheriges Passwort bleibt gültig. TanzRaum fragt dich niemals per E-Mail nach deinem Passwort. ${GUELTIG}`,
    }),
  };
}

export function emailAendernNeu(p: { vorname?: string | null; link: string; neueEmail: string }): Mail {
  return {
    betreff: "TanzRaum – neue E-Mail-Adresse bestätigen",
    html: layout({
      vorschau: "Bestätige deine neue E-Mail-Adresse für TanzRaum.",
      titel: "Neue E-Mail-Adresse bestätigen",
      absaetze: [
        hallo(p.vorname),
        `du möchtest die E-Mail-Adresse deines TanzRaum-Kontos auf <strong>${esc(p.neueEmail)}</strong> ändern. Bitte bestätige, dass diese Adresse dir gehört.`,
      ],
      button: { text: "Neue E-Mail-Adresse bestätigen", url: p.link },
      hinweis: `Du hast keine Änderung angefordert? Dann ignoriere diese E-Mail – es wird nichts geändert. ${GUELTIG}`,
    }),
  };
}

export function emailAendernAlt(p: { vorname?: string | null; link: string; neueEmail: string }): Mail {
  return {
    betreff: "TanzRaum – Änderung deiner E-Mail-Adresse bestätigen",
    html: layout({
      vorschau: "Für dein TanzRaum-Konto wurde eine neue E-Mail-Adresse angefragt.",
      titel: "Änderung deiner E-Mail-Adresse",
      absaetze: [
        hallo(p.vorname),
        `für dein TanzRaum-Konto wurde angefragt, die E-Mail-Adresse auf <strong>${esc(p.neueEmail)}</strong> zu ändern. Zur Sicherheit muss die Änderung auch von deiner bisherigen Adresse aus bestätigt werden.`,
      ],
      button: { text: "Änderung bestätigen", url: p.link },
      hinweis: `<strong>Das warst du nicht?</strong> Klicke nicht auf den Button, ändere am besten sofort dein Passwort und melde dich bei uns. ${GUELTIG}`,
    }),
  };
}

export function anmeldelink(p: { vorname?: string | null; link: string }): Mail {
  return {
    betreff: "TanzRaum – dein Anmeldelink",
    html: layout({
      vorschau: "Melde dich mit einem Klick bei TanzRaum an.",
      titel: "Dein Anmeldelink",
      absaetze: [hallo(p.vorname), "hier ist dein persönlicher Link zur Anmeldung bei TanzRaum."],
      button: { text: "Bei TanzRaum anmelden", url: p.link },
      hinweis: `Du hast keinen Anmeldelink angefordert? Dann ignoriere diese E-Mail. ${GUELTIG}`,
    }),
  };
}

export function kontoEinladung(p: { link: string }): Mail {
  return {
    betreff: "Du wurdest zu TanzRaum eingeladen",
    html: layout({
      vorschau: "Nimm deine Einladung zu TanzRaum an.",
      titel: "Du wurdest zu TanzRaum eingeladen",
      absaetze: ["Hallo,", "du wurdest eingeladen, ein Konto bei TanzRaum zu erstellen – der Plattform für den karnevalistischen Tanzsport."],
      button: { text: "Einladung annehmen", url: p.link },
      hinweis: `Du kennst den Absender nicht? Dann ignoriere diese E-Mail. ${GUELTIG}`,
    }),
  };
}

export function sicherheitscode(p: { vorname?: string | null; code: string }): Mail {
  return {
    betreff: `TanzRaum – dein Sicherheitscode ${p.code}`,
    html: layout({
      vorschau: "Dein Sicherheitscode für TanzRaum.",
      titel: "Dein Sicherheitscode",
      absaetze: [
        hallo(p.vorname),
        "bitte gib diesen Code in TanzRaum ein, um die Aktion zu bestätigen:",
        `<span style="display:inline-block;font-size:30px;letter-spacing:8px;font-weight:bold;color:#1b2130;background:#f5f6f9;border-radius:12px;padding:12px 20px;">${esc(p.code)}</span>`,
      ],
      hinweis: "Gib diesen Code niemals an andere Personen weiter. Das TanzRaum-Team fragt dich nie nach diesem Code.",
    }),
  };
}

const SICHERHEIT: Record<string, { titel: string; text: string }> = {
  password_changed_notification: { titel: "Dein Passwort wurde geändert", text: "das Passwort deines TanzRaum-Kontos wurde soeben geändert." },
  email_changed_notification: { titel: "Deine E-Mail-Adresse wurde geändert", text: "die E-Mail-Adresse deines TanzRaum-Kontos wurde soeben geändert." },
  phone_changed_notification: { titel: "Deine Telefonnummer wurde geändert", text: "die Telefonnummer deines TanzRaum-Kontos wurde soeben geändert." },
  identity_linked_notification: { titel: "Neue Anmeldemethode verknüpft", text: "mit deinem TanzRaum-Konto wurde soeben eine neue Anmeldemethode verknüpft." },
  identity_unlinked_notification: { titel: "Anmeldemethode entfernt", text: "von deinem TanzRaum-Konto wurde soeben eine Anmeldemethode entfernt." },
  mfa_factor_enrolled_notification: { titel: "Zwei-Faktor-Anmeldung eingerichtet", text: "für dein TanzRaum-Konto wurde soeben ein zusätzlicher Anmeldefaktor eingerichtet." },
  mfa_factor_unenrolled_notification: { titel: "Zwei-Faktor-Anmeldung entfernt", text: "von deinem TanzRaum-Konto wurde soeben ein Anmeldefaktor entfernt." },
};

export function sicherheitsmeldung(p: { art: string; vorname?: string | null; loginUrl: string; zusatz?: string }): Mail | null {
  const s = SICHERHEIT[p.art];
  if (!s) return null;
  const zeit = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "short" });
  return {
    betreff: `TanzRaum – ${s.titel}`,
    html: layout({
      vorschau: `Sicherheitsinfo: ${s.titel}.`,
      titel: s.titel,
      absaetze: [hallo(p.vorname), `${s.text} (${esc(zeit)} Uhr)`, ...(p.zusatz ? [p.zusatz] : []), "Wenn du das selbst warst, ist alles in Ordnung und du musst nichts weiter tun."],
      button: { text: "Zu TanzRaum", url: p.loginUrl },
      fallbackLink: false,
      hinweis: `<strong>Das warst du nicht?</strong> Setze über „Passwort vergessen?“ auf der Anmeldeseite sofort ein neues Passwort und melde dich bei uns unter <a href="mailto:info@tanzraum.app">info@tanzraum.app</a>.`,
    }),
  };
}

export function vereinsEinladung(p: { vereinName: string; gruppeName?: string | null; rolle?: string | null; einlader?: string | null; link: string; gueltigBis?: string | null }): Mail {
  const ziel = p.gruppeName ? `der Gruppe <strong>${esc(p.gruppeName)}</strong> im Verein <strong>${esc(p.vereinName)}</strong>` : `dem Verein <strong>${esc(p.vereinName)}</strong>`;
  const bis = p.gueltigBis ? new Date(p.gueltigBis).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "long" }) : null;
  return {
    betreff: p.gruppeName ? `Einladung zu ${p.gruppeName} (${p.vereinName}) bei TanzRaum` : `Einladung zu ${p.vereinName} bei TanzRaum`,
    html: layout({
      vorschau: `${p.einlader ?? "Dein Verein"} lädt dich zu ${p.gruppeName ?? p.vereinName} ein.`,
      titel: p.gruppeName ? `Einladung zur Gruppe ${p.gruppeName}` : `Einladung zu ${p.vereinName}`,
      absaetze: [
        "Hallo,",
        `${p.einlader ? `<strong>${esc(p.einlader)}</strong> lädt` : "Du wirst"} dich ein, ${ziel} bei TanzRaum beizutreten${p.rolle ? ` (als ${esc(p.rolle)})` : ""}.`,
        "Mit TanzRaum hast du Trainingszeiten, Termine, Turniere und den Vereinschat immer dabei. Noch kein Konto? Kein Problem – du kannst es nach dem Klick in einer Minute anlegen.",
      ],
      button: { text: "Einladung annehmen", url: p.link },
      hinweis: `Du kennst den Verein nicht oder erwartest keine Einladung? Dann ignoriere diese E-Mail.${bis ? ` Die Einladung ist gültig bis ${esc(bis)}.` : ""}`,
    }),
  };
}

export function rundschreiben(p: { vereinName: string; absender?: string | null; betreff: string; text: string }): Mail {
  return {
    betreff: `${p.betreff} – ${p.vereinName}`,
    html: layout({
      vorschau: p.text.slice(0, 120),
      titel: p.betreff,
      absaetze: [`<span style="white-space:pre-wrap;">${esc(p.text)}</span>`],
      fuss: `Rundschreiben von ${esc(p.vereinName)}${p.absender ? `, gesendet von ${esc(p.absender)}` : ""} über TanzRaum.`,
    }),
  };
}
