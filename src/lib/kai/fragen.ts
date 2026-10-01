import type { KaiFrage } from "./typen";

// „Frag Kai“: feste Fragen und Antworten – ohne KI und ohne externe Schnittstelle.
// Kai sucht die passende Antwort ueber Stichwoerter und fuehrt per Link zum richtigen Bereich.
// Neue Fragen einfach hier ergaenzen (Stichwoerter klein, ohne Umlaut-Sonderfaelle – die Suche vereinheitlicht selbst).

export const KAI_FRAGEN: KaiFrage[] = [
  { id: "turniere", bereiche: ["/dashboard/turniere", "/dashboard/saisonplanung"], frage: "Wo finde ich meine Turniere?", stichworte: ["turnier", "turniere", "wettkampf", "start", "starts", "meisterschaft"],
    antwort: "Unter „Turniere“. Oben siehst du „Deine nächsten Starts“ und kannst deinem Verein Bescheid geben, ob du dabei bist.",
    aktion: { label: "Zu den Turnieren", href: "/dashboard/turniere" } },
  { id: "training-abmelden", bereiche: ["/dashboard/training"], frage: "Wie melde ich mich vom Training ab?", stichworte: ["abmelden", "abmeldung", "training", "krank", "absagen", "fehlen", "nicht kommen"],
    antwort: "Du bist automatisch eingeplant. Kannst du nicht kommen, tippe unter „Training“ beim jeweiligen Termin auf „Vom Training abmelden“, wähle einen Grund und bestätige – der zuständige Trainer wird informiert. Die Abmeldung gilt nur für diesen einen Termin; „Wieder anmelden“ macht sie rückgängig.",
    aktion: { label: "Zum Training", href: "/dashboard/training" } },
  { id: "einstellungen", bereiche: ["/dashboard/einstellungen"], frage: "Wie ändere ich meine Einstellungen?", stichworte: ["einstellung", "einstellungen", "profil", "passwort", "email", "e-mail", "konto"],
    antwort: "Über „Einstellungen“ im Menü: E-Mail, Passwort, Profil-Angaben, Privatsphäre, Benachrichtigungen und Datenschutz.",
    aktion: { label: "Einstellungen öffnen", href: "/dashboard/einstellungen" } },
  { id: "benachrichtigungen", bereiche: ["/dashboard/einstellungen"], frage: "Wie stelle ich Benachrichtigungen ein?", stichworte: ["benachrichtigung", "benachrichtigungen", "push", "mitteilung", "ton", "handy"],
    antwort: "In den Einstellungen unter „Push-Benachrichtigungen“ – für dieses Gerät und je Thema.",
    aktion: { label: "Benachrichtigungen öffnen", href: "/dashboard/einstellungen#push" } },
  { id: "privat", bereiche: ["/dashboard/einstellungen", "/dashboard/netzwerk"], frage: "Wie mache ich mein Konto privat?", stichworte: ["privat", "privatsphaere", "sichtbar", "unsichtbar", "online", "karte", "map"],
    antwort: "In den Einstellungen unter „Privatsphäre“, „Online-Status“ und „TanzRaum Map“ bestimmst du, was andere von dir sehen.",
    aktion: { label: "Privatsphäre öffnen", href: "/dashboard/einstellungen#privatsphaere" } },
  { id: "verein-beitreten", bereiche: ["/dashboard/verein"], frage: "Wie komme ich in meinen Verein?", stichworte: ["verein", "beitreten", "einladung", "code", "mitglied werden"],
    antwort: "Zwei Wege: Mit dem Einladungslink deines Vereins (Link öffnen, registrieren bzw. anmelden, Einladung annehmen) – oder unter „Mein Verein“ bei „Verein suchen“ deinen Verein finden und den Beitritt anfragen. Mitglied wirst du, sobald der Verein annimmt.",
    aktion: { label: "Mein Verein öffnen", href: "/dashboard/verein" } },
  { id: "termin", bereiche: ["/dashboard/kalender"], frage: "Wie lege ich einen Termin an?", stichworte: ["termin", "kalender", "eintragen", "anlegen", "datum"],
    antwort: "Im Kalender auf „Termin anlegen“ tippen, Titel, Datum und Uhrzeit eintragen und speichern.",
    aktion: { label: "Termin anlegen", href: "/dashboard/kalender/neu" } },
  { id: "kalender-sync", bereiche: ["/dashboard/kalender"], frage: "Wie bekomme ich die Termine in meinen Handy-Kalender?", stichworte: ["synchronisieren", "sync", "ical", "google", "apple", "outlook", "handy kalender"],
    antwort: "Im Kalender unten auf „Mit deinem Kalender synchronisieren“ – das funktioniert mit Google, Apple und Outlook.",
    aktion: { label: "Zum Kalender", href: "/dashboard/kalender" } },
  { id: "nachricht", bereiche: ["/dashboard/nachrichten"], frage: "Wie schreibe ich jemandem eine Nachricht?", stichworte: ["nachricht", "chat", "schreiben", "direktnachricht", "kontakt"],
    antwort: "Oben über die Sprechblase zu „Nachrichten“ und dort einen neuen Chat beginnen.",
    aktion: { label: "Zu den Nachrichten", href: "/dashboard/nachrichten" } },
  { id: "fahrgemeinschaft", bereiche: ["/dashboard/fahrgemeinschaften"], frage: "Wie finde ich eine Mitfahrgelegenheit?", stichworte: ["fahrgemeinschaft", "mitfahren", "mitfahrt", "fahrt", "auto"],
    antwort: "Unter „Fahrgemeinschaften“ Fahrten deines Vereins ansehen oder selbst eine anbieten bzw. suchen.",
    aktion: { label: "Zu den Fahrgemeinschaften", href: "/dashboard/fahrgemeinschaften" } },
  { id: "kostuem", bereiche: ["/dashboard/kostueme"], frage: "Welche Kostüme habe ich ausgeliehen?", stichworte: ["kostuem", "kostueme", "requisit", "ausgeliehen", "rueckgabe"],
    antwort: "Unter „Kostüme & Requisiten“ siehst du alles, was dir oder deinem Kind ausgegeben ist – mit Rückgabedatum.",
    aktion: { label: "Zu den Kostümen", href: "/dashboard/kostueme" } },
  { id: "vereinslizenz", bereiche: ["/dashboard/tarif", "/dashboard/verein"], frage: "💡 Was ist die VEREIN-Lizenz?", stichworte: ["verein-lizenz", "vereinslizenz", "verein lizenz", "lizenz verein", "mitglieder abgedeckt", "unbegrenzt", "wie viele mitglieder"],
    antwort: "Die VEREIN-Lizenz gilt für einen ganzen Verein und deckt alle aktiven Mitglieder dieses Vereins ab. Die Anzahl der aktiven Mitglieder ist nicht begrenzt. Abgedeckte Mitglieder müssen keine eigene BASIC-Lizenz bezahlen.",
    aktion: { label: "Mein Tarif öffnen", href: "/dashboard/tarif" } },
  { id: "basic-pausiert", bereiche: ["/dashboard/tarif"], frage: "💡 Was passiert mit BASIC, wenn mein Verein TanzRaum nutzt?", stichworte: ["basic", "pausiert", "pause", "doppelt zahlen", "abbuchung", "verein lizenz basic", "weiterlaufen"],
    antwort: "Hast du eine eigene BASIC-Lizenz und wirst über die VEREIN-Lizenz deines Vereins abgedeckt, wird deine BASIC-Lizenz automatisch pausiert – während der Abdeckung wird nichts abgebucht. Endet die Vereinsabdeckung, läuft deine BASIC-Lizenz automatisch weiter. Sie wird weder gelöscht noch musst du sie neu abschließen.",
    aktion: { label: "Mein Tarif öffnen", href: "/dashboard/tarif" } },
  { id: "tarif", bereiche: ["/dashboard/tarif"], frage: "Welchen Tarif habe ich?", stichworte: ["tarif", "basic", "free", "lizenz", "abo", "kosten", "preis", "bezahlen"],
    antwort: "Unter „Mein Tarif“ siehst du deinen Tarif und – als Vereinsadmin – eure Vereinslizenz.",
    aktion: { label: "Mein Tarif öffnen", href: "/dashboard/tarif" } },
  { id: "app", frage: "Wie installiere ich TanzRaum als App?", stichworte: ["app", "installieren", "startbildschirm", "iphone", "android"],
    antwort: "TanzRaum ist eine Web-App: im Browser „Zum Home-Bildschirm“ bzw. „App installieren“ wählen. Die Anleitung für dein Gerät steht auf der Startseite.",
    aktion: { label: "Anleitung ansehen", href: "/#app" } },
  { id: "loeschen", bereiche: ["/dashboard/einstellungen"], frage: "Wie lösche ich mein Konto?", stichworte: ["loeschen", "konto loeschen", "abmelden konto", "kuendigen"],
    antwort: "In den Einstellungen ganz unten unter „Konto löschen“. Du hast danach 14 Tage Zeit, es dir anders zu überlegen.",
    aktion: { label: "Einstellungen öffnen", href: "/dashboard/einstellungen" } },
  // Kalender
  { id: "vereinstermin", bereiche: ["/dashboard/kalender", "/dashboard/saisonplanung"], frage: "Wer legt Vereinstermine an?", stichworte: ["vereinstermin", "auftritt", "fest", "saison"],
    antwort: "Vereinstermine legen Vereinsadmin und Trainer an (bzw. wer die Saisonplanung freigeschaltet hat). Eigene Termine kann jede Person anlegen – die sieht nur sie selbst.",
    aktion: { label: "Zum Kalender", href: "/dashboard/kalender" } },
  // Training & Anwesenheit
  { id: "anwesenheit", bereiche: ["/dashboard/training", "/dashboard/anwesenheit"], frage: "Wie erfasse ich die Anwesenheit?", stichworte: ["anwesenheit", "anwesend", "fehlt", "liste", "teilnahme"],
    antwort: "Unter „Anwesenheit“ das Training wählen, „Alle Anwesenden markieren“ tippen und nur die Ausnahmen korrigieren – auch nachträglich für die letzten 7 Tage. Das dürfen Vereinsadmin, Trainer und Betreuer ihrer Gruppen.",
    aktion: { label: "Zur Anwesenheit", href: "/dashboard/anwesenheit" } },
  { id: "training-anlegen", bereiche: ["/dashboard/training"], frage: "Wie lege ich ein Training an?", stichworte: ["training anlegen", "trainingszeit", "neues training", "halle"],
    antwort: "Unter „Training“ oben auf „Training anlegen“ – für einmalige oder wöchentliche Trainings. Das dürfen Vereinsadmin und Trainer ihrer Gruppen.",
    aktion: { label: "Zum Training", href: "/dashboard/training" } },
  { id: "kind-abmelden", bereiche: ["/dashboard/training"], frage: "Wie melde ich mein Kind vom Training ab?", stichworte: ["kind", "tochter", "sohn", "eltern"],
    antwort: "Unter „Training“ siehst du die Trainings aller deiner Kinder, jedes Kind einzeln. Beim Kind auf „… abmelden“ tippen, Grund wählen und bestätigen – nur für diesen Termin.",
    aktion: { label: "Zum Training", href: "/dashboard/training" } },
  // Mitglieder
  { id: "mitglieder-import", bereiche: ["/dashboard/mitglieder"], frage: "💡 Du hast schon eine Mitgliederliste?", stichworte: ["import", "importieren", "mitgliederliste", "csv", "excel", "xlsx", "vereinssoftware", "liste", "uebernehmen", "export"],
    antwort: "Du kannst deine Mitgliederliste aus deiner bisherigen Vereinssoftware als CSV oder Excel exportieren und hier importieren. Du entscheidest selbst, welche Daten übernommen werden. Anschließend kannst du deine Mitglieder per E-Mail oder persönlichem Einladungslink zu TanzRaum einladen. Wichtig: Der Import erstellt noch kein TanzRaum-Konto. Jedes Mitglied registriert sich selbst.",
    aktion: { label: "→ Mitglieder importieren", href: "/dashboard/mitglieder/import" } },
  { id: "mitglieder-einladen", bereiche: ["/dashboard/mitglieder"], frage: "Wie lade ich Mitglieder ohne Konto zu TanzRaum ein?", stichworte: ["einladen", "einladung", "einladungslink", "link", "kein konto", "registrieren", "whatsapp", "erneut senden"],
    antwort: "In „Mitglieder“ siehst du bei jedem Mitglied den Kontostatus: 🟢 Konto vorhanden, 🟠 Einladung ausstehend oder ⚪ Noch kein TanzRaum-Konto. Bei „Noch kein Konto“ tippst du auf „Einladen“ (E-Mail) oder „Link kopieren“ (persönlicher Link, z. B. für WhatsApp). Mehrere Mitglieder wählst du mit den Kästchen aus. Registriert sich jemand über seinen Link, wechselt der Status automatisch auf „Konto vorhanden“.",
    schritte: ["Oben bei „TanzRaum-Mitgliederstatus“ auf „Noch kein TanzRaum-Konto“ tippen", "„Alle auswählen“ ankreuzen", "„Mitglieder einladen“ oder „Einladungslinks anzeigen“ wählen"],
    aktion: { label: "Zu den Mitgliedern", href: "/dashboard/mitglieder?konto=ohne" } },
  { id: "mitglied-finden", bereiche: ["/dashboard/mitglieder"], frage: "Wie finde ich ein bestimmtes Mitglied?", stichworte: ["mitglied finden", "suchen", "filter", "mitgliederliste"],
    antwort: "In „Mitglieder“ oben nach dem Namen suchen und nach Gruppe, Rolle oder Status filtern. Du siehst nur, was deine Rolle erlaubt.",
    aktion: { label: "Zu den Mitgliedern", href: "/dashboard/mitglieder" } },
  { id: "mitglied-hinzufuegen", bereiche: ["/dashboard/mitglieder", "/dashboard/mitgliedsantraege"], frage: "Wie nehme ich ein neues Mitglied auf?", stichworte: ["mitglied hinzufuegen", "einladen", "neues mitglied", "aufnehmen", "antrag"],
    antwort: "Als Vereinsadmin unter „Mitglieder“ auf „Mitglied anlegen“ – mit Namen und E-Mail, danach per E-Mail oder persönlichem Link einladen. Viele Mitglieder auf einmal übernimmst du mit „Mitglieder importieren“ (CSV/Excel). Eingegangene Mitgliedsanträge prüfst du unter „Mitgliedsanträge“.",
    aktion: { label: "Zu den Mitgliedern", href: "/dashboard/mitglieder" } },
  { id: "rolle-aendern", bereiche: ["/dashboard/mitglieder"], frage: "Wie ändere ich die Rolle eines Mitglieds?", stichworte: ["rolle", "rechte", "trainer machen", "betreuer", "admin"],
    antwort: "Als Vereinsadmin in „Mitglieder“ das Mitglied öffnen und dort Rolle und Gruppen anpassen.",
    aktion: { label: "Zu den Mitgliedern", href: "/dashboard/mitglieder" } },
  // Tanzgruppen
  { id: "gruppen", bereiche: ["/dashboard/verein", "/dashboard/mitglieder"], frage: "Wo verwalte ich unsere Tanzgruppen?", stichworte: ["gruppe", "gruppen", "tanzgruppe", "garde", "formation"],
    antwort: "Unter „Mein Verein“ im Bereich Gruppen. Mit „Gruppe anlegen“ führt dich ein Assistent Schritt für Schritt: Name, Altersklasse, Disziplin, Tänzer, Trainer und Betreuer. Eine Gruppe öffnest du per Tippen – dort änderst du Mitglieder, Trainer, Betreuer, Altersklasse oder Disziplin.",
    aktion: { label: "Mein Verein öffnen", href: "/dashboard/verein" } },
  { id: "gruppe-anlegen", bereiche: ["/dashboard/verein"], frage: "Wie lege ich eine neue Gruppe an?", stichworte: ["gruppe anlegen", "neue gruppe", "tanzpaar", "solist", "assistent", "altersklasse", "disziplin"],
    antwort: "Unter „Mein Verein“ → Gruppen → „Gruppe anlegen“. Wähle Gruppe, Tanzpaar oder Solist, gib einen Namen ein (nicht die Altersklasse), wähle die Altersklasse (Jugend, Junioren, Ü15 oder eine eigene wie „Bambinis“) und die passende Disziplin. Danach Tänzer, Trainer und optional Betreuer auswählen und in der Übersicht „Gruppe erstellen“. Eilig? „Schnell anlegen“ braucht nur den Namen.",
    schritte: ["Mein Verein öffnen", "„Gruppe anlegen“ tippen", "Schritte durchgehen", "In der Übersicht „Gruppe erstellen“"],
    aktion: { label: "Mein Verein öffnen", href: "/dashboard/verein" } },
  { id: "gruppe-zuordnen", bereiche: ["/dashboard/verein", "/dashboard/mitglieder"], frage: "Wie ordne ich jemanden einer Gruppe zu?", stichworte: ["zuordnen", "gruppe hinzufuegen", "in gruppe"],
    antwort: "Am einfachsten in „Mein Verein“: Gruppe öffnen und „Mitglieder ändern“, „Trainer ändern“ oder „Betreuer ändern“ tippen. Alternativ in „Mitglieder“ das Mitglied öffnen und die Gruppe auswählen.",
    aktion: { label: "Zu den Mitgliedern", href: "/dashboard/mitglieder" } },
  // Turniere
  { id: "start-zusagen", bereiche: ["/dashboard/turniere"], frage: "Wie sage ich für ein Turnier zu?", stichworte: ["zusagen", "dabei", "teilnahme turnier", "starten"],
    antwort: "Unter „Turniere“ bei „Deine nächsten Starts“ auf „Dabei“ oder „Nicht dabei“ tippen – dein Verein sieht es sofort.",
    aktion: { label: "Zu den Turnieren", href: "/dashboard/turniere" } },
  { id: "turnier-merken", bereiche: ["/dashboard/turniere"], frage: "Wie merke ich mir ein Turnier?", stichworte: ["merken", "gemerkt", "merkliste", "favorit"],
    antwort: "Beim Turnier auf „Merken“ tippen – gemerkte Turniere findest du im Reiter „Gemerkt“.",
    aktion: { label: "Zu den Turnieren", href: "/dashboard/turniere" } },
  // Einstellungen
  { id: "passwort", bereiche: ["/dashboard/einstellungen"], frage: "Wie ändere ich mein Passwort?", stichworte: ["passwort", "kennwort", "sicherheit"],
    antwort: "In den Einstellungen unter „Passwort“. Danach wirst du auf allen anderen Geräten abgemeldet.",
    aktion: { label: "Einstellungen öffnen", href: "/dashboard/einstellungen" } },
  { id: "hilfe", frage: "Wie erreiche ich das TanzRaum-Team?", stichworte: ["hilfe", "support", "kontakt", "problem", "fehler", "team"],
    antwort: "Unter „Support & Hilfe“ findest du häufige Fragen und den direkten Kontakt zum TanzRaum-Team.",
    aktion: { label: "Support & Hilfe", href: "/dashboard/hilfe" } },
];

function normal(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Hilfethemen fuer den aktuellen Bereich (Route) – zuerst die passenden, sonst allgemeine Fragen
export function kaiThemen(pfad: string, erlaubt?: (href: string) => boolean, max = 4): KaiFrage[] {
  const nutzbar = KAI_FRAGEN.filter((f) => !f.aktion || !erlaubt || erlaubt(f.aktion.href));
  const passend = nutzbar.filter((f) => f.bereiche?.some((b) => pfad === b || pfad.startsWith(`${b}/`)));
  return (passend.length ? passend : nutzbar.filter((f) => ["turniere", "training-abmelden", "einstellungen", "hilfe"].includes(f.id))).slice(0, max);
}

// Beste Treffer fuer eine Frage (einfaches Stichwort-Punkten, keine KI)
export function kaiFragen(eingabe: string, erlaubt?: (href: string) => boolean, max = 3): KaiFrage[] {
  const q = normal(eingabe);
  if (q.length < 2) return [];
  const woerter = q.split(" ").filter((w) => w.length > 2);
  return KAI_FRAGEN.filter((f) => !f.aktion || !erlaubt || erlaubt(f.aktion.href))
    .map((f) => {
      const fr = normal(f.frage);
      let punkte = fr.includes(q) ? 5 : 0;
      for (const s of f.stichworte) {
        const sn = normal(s);
        if (q.includes(sn)) punkte += 3;
        else if (woerter.some((w) => sn.startsWith(w) || w.startsWith(sn))) punkte += 2;
      }
      for (const w of woerter) if (fr.includes(w)) punkte += 1;
      return { f, punkte };
    })
    .filter((x) => x.punkte >= 2)
    .sort((a, b) => b.punkte - a.punkte)
    .slice(0, max)
    .map((x) => x.f);
}
