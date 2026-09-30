import type { KaiKontext, KaiNeuigkeit, KaiSchritt, KaiTipp } from "./typen";

// Alle Texte von Kai an einer Stelle – neue Tipps, Schritte oder Neuigkeiten werden nur hier ergaenzt.

export const KAI_NAME = "Kai";
export const KAI_UNTERTITEL = "Dein TanzRaum-Begleiter";

export const BEGRUESSUNG = {
  erstes: {
    titel: "👋 Hallo, ich bin Kai!",
    text: "Ich helfe dir dabei, TanzRaum einzurichten. Lass uns gemeinsam die wichtigsten Einstellungen durchgehen.",
    hinweis: "Du entscheidest bei jedem Schritt selbst – ich zeige dir nur, wo du was findest, und ändere nichts für dich.",
  },
  wieder: (vorname: string) => ({
    titel: vorname ? `Hallo ${vorname}!` : "Hallo!",
    text: "Wobei kann ich dir helfen?",
  }),
};

// Einrichtungshilfe: Reihenfolge und Inhalte je nach Rolle
export function einrichtungsSchritte(k: KaiKontext): KaiSchritt[] {
  const schritte: KaiSchritt[] = [];
  if (!k.istPlattformAdmin) {
    schritte.push({
      id: "profil",
      titel: "Dein Profil",
      text: k.hatVerein
        ? "Prüfe, wie du in Profil und Mitgliederlisten bezeichnet wirst (z. B. Tänzerin oder Tänzer)."
        : "Prüfe deine Bezeichnung im Profil und gib auf Wunsch an, in welchem Verein du tanzt – freiwillig und jederzeit änderbar.",
      aktion: { label: "Profil-Angaben öffnen", href: "/dashboard/einstellungen#profil" },
    });
  }
  schritte.push({
    id: "benachrichtigungen",
    titel: "Benachrichtigungen",
    text: "Lege fest, auf welchem Gerät und wofür du benachrichtigt wirst – z. B. neue Nachrichten, News oder Fahrgemeinschaften.",
    aktion: { label: "Benachrichtigungen öffnen", href: "/dashboard/einstellungen#push" },
  });
  if (!k.istPlattformAdmin) {
    schritte.push({
      id: "privatsphaere",
      titel: "Privatsphäre & Sichtbarkeit",
      text: "Bestimme, ob dein Konto privat ist, ob andere sehen, dass du online bist, und ob du auf der TanzRaum-Karte erscheinst.",
      aktion: { label: "Privatsphäre öffnen", href: "/dashboard/einstellungen#privatsphaere" },
    });
  }
  schritte.push({
    id: "datenschutz",
    titel: "Datenschutz",
    text: "Hier siehst du deine Einwilligungen mit Zeitpunkt und Fassung. Du kannst sie jederzeit ändern.",
    aktion: { label: "Datenschutz öffnen", href: "/dashboard/einstellungen#datenschutz" },
  });
  if (!k.istPlattformAdmin) {
    if (k.istVereinsadmin) {
      schritte.push({
        id: "verein",
        titel: "Verein & Gruppen einrichten",
        text: "Pflege Vereinsdaten und Gruppen, lege fest, wer welche Bereiche nutzt, und lade Mitglieder ein.",
        aktion: { label: "Vereinsverwaltung öffnen", href: "/dashboard/vereinsverwaltung" },
      });
    } else if (k.hatVerein) {
      schritte.push({
        id: "verein",
        titel: "Dein Verein & deine Gruppen",
        text: "Sieh dir an, in welchen Gruppen du bist und wer eure Ansprechpartner sind.",
        aktion: { label: "Mein Verein öffnen", href: "/dashboard/verein" },
      });
    } else {
      schritte.push({
        id: "verein",
        titel: "Verein",
        text: "Hast du eine Einladung von deinem Verein? Dann löst du sie hier ein. Du kannst deinen Verein auch neu registrieren – oder TanzRaum ganz ohne Verein nutzen.",
        aktion: { label: "Mein Verein öffnen", href: "/dashboard/verein" },
      });
    }
  }
  schritte.push({
    id: "app",
    titel: "TanzRaum als App",
    text: "Leg TanzRaum auf deinen Startbildschirm – dann ist es mit einem Tipp da und du bekommst Benachrichtigungen auch auf dem Handy.",
    aktion: { label: "So geht's", href: "/#app" },
  });
  return schritte;
}

// Tipps passend zur aktuellen Seite (laengster passender Pfad gewinnt)
export const KONTEXT_TIPPS: KaiTipp[] = [
  { pfad: "/dashboard", exakt: true, zeile: "👋 Schön, dass du da bist!", titel: "Dein Dashboard", pose: "begruessung",
    text: "Hier siehst du auf einen Blick, was heute wichtig ist. Oben durchsuchst du TanzRaum (Lupe), die Glocke zeigt Benachrichtigungen, die Sprechblase deine Nachrichten." },
  { pfad: "/dashboard/kalender", zeile: "💡 Soll ich dir zeigen, wie du einen Termin anlegst?", titel: "Termin anlegen", pose: "idee",
    text: "Eigene Termine siehst nur du; Vereinstermine legen Vereinsadmin und Trainer an.",
    schritte: ["Oben auf „Termin anlegen“ tippen – oder im Monat auf „+ Termin an diesem Tag“.", "Titel, Datum und Uhrzeit eintragen.", "Speichern – fertig."],
    aktion: { label: "Termin anlegen", href: "/dashboard/kalender/neu" } },
  { pfad: "/dashboard/training", zeile: "👀 Hier kannst du deine Teilnahme verwalten.", titel: "Training", pose: "erklaeren",
    text: "Kannst du nicht kommen? Tippe beim Training auf „Abmelden“ und gib optional einen Grund an – dein Trainerteam sieht es sofort. Eltern melden hier auch ihre Kinder ab." },
  { pfad: "/dashboard/anwesenheit", zeile: "✅ Anwesenheit in Sekunden.", titel: "Anwesenheit", pose: "erklaeren",
    text: "Tippe „Alle Anwesenden markieren“ und korrigiere nur die Ausnahmen – auch nachträglich für die letzten 7 Tage." },
  { pfad: "/dashboard/mitglieder", zeile: "💡 So findest du jedes Mitglied schnell.", titel: "Mitglieder", pose: "idee",
    text: "Suche nach Namen und filtere nach Gruppe, Rolle oder Status. Du siehst nur, was deine Rolle im Verein erlaubt." },
  { pfad: "/dashboard/turniere", zeile: "🏆 Hier findest du die Turniere deiner Gruppen.", titel: "Turniere", pose: "sport",
    text: "Merke dir Turniere und gib deinem Verein Bescheid, ob du startest. Die offizielle Meldung macht dein Verein beim Verband." },
  { pfad: "/dashboard/saisonplanung", zeile: "📅 Die ganze Saison auf einen Blick.", titel: "Saisonplanung", pose: "sport",
    text: "Turniere, Auftritte und Feste des Vereins nach Datum – mit Treffpunkt und Verantwortlichen." },
  { pfad: "/dashboard/einstellungen", zeile: "⚙️ Soll ich dich durch die Einstellungen führen?", titel: "Einstellungen", pose: "erklaeren",
    text: "Profil, Privatsphäre, Benachrichtigungen und Datenschutz – jede Änderung speicherst du selbst. Mit „Einrichtung starten“ gehen wir die wichtigsten Punkte gemeinsam durch." },
  { pfad: "/dashboard/verein", zeile: "🏠 Dein Verein auf einen Blick.", titel: "Mein Verein", pose: "erklaeren",
    text: "Vereinsdaten, deine Gruppen und die Ansprechpartner deines Vereins." },
  { pfad: "/dashboard/vereinsverwaltung", zeile: "🛠️ Hier richtest du deinen Verein ein.", titel: "Vereinsverwaltung", pose: "erklaeren",
    text: "Vereinsdaten, Bereiche und Zugriffe je Rolle, Mitgliedsanträge, Ehrungen und mehr." },
  { pfad: "/dashboard/nachrichten", zeile: "💬 Alle Chats an einem Ort.", titel: "Nachrichten", pose: "erklaeren",
    text: "Vereins- und Gruppenchats sowie Direktnachrichten. Stummschalten kannst du jeden Chat einzeln." },
  { pfad: "/dashboard/fahrgemeinschaften", zeile: "🚗 Gemeinsam hin und zurück.", titel: "Fahrgemeinschaften", pose: "hinweis",
    text: "Biete freie Plätze an oder suche eine Mitfahrt – nur innerhalb deines Vereins." },
  { pfad: "/dashboard/kostueme", zeile: "👗 Alles rund um Kostüme.", titel: "Kostüme & Requisiten", pose: "hinweis",
    text: "Hier siehst du, was dir (oder deinem Kind) ausgegeben ist – mit Größe und Rückgabedatum." },
  { pfad: "/dashboard/finanzen", zeile: "💶 Kasse und Beiträge im Griff.", titel: "Finanzen", pose: "erklaeren",
    text: "Kassenbuch mit Belegen und Mitgliedsbeiträge. Wiederkehrende Beiträge legt TanzRaum auf Wunsch automatisch an." },
  { pfad: "/dashboard/boerse", zeile: "🛍️ Kaufen, verkaufen, tauschen.", titel: "TanzRaum Börse", pose: "hinweis",
    text: "Kostüme, Schuhe und Zubehör – der Kontakt läuft sicher über den TanzRaum-Chat." },
  { pfad: "/dashboard/netzwerk", zeile: "🌍 Entdecke die TanzRaum-Welt.", titel: "TanzRaum Connect", pose: "erklaeren",
    text: "Vereine und Tänzer/innen auf der Karte oder in der Liste. Ob du selbst sichtbar bist, stellst du in den Einstellungen ein." },
  { pfad: "/dashboard/news", zeile: "📣 Neues aus deinem Verein.", titel: "News & Umfragen", pose: "hinweis",
    text: "Wichtige Informationen und Abstimmungen aus deinem Verein – und Ankündigungen von TanzRaum." },
  { pfad: "/dashboard/dateien", zeile: "📁 Eure Dateien, sicher abgelegt.", titel: "TeamCloud", pose: "erklaeren",
    text: "Dokumente, Musik und Pläne deines Vereins – und eigene Dateien, die nur du siehst." },
  { pfad: "/dashboard/tarif", zeile: "💳 Dein Tarif im Überblick.", titel: "Mein Tarif", pose: "erklaeren",
    text: "Dein Tarif und – falls du Vereinsadmin bist – eure Vereinslizenz." },
  { pfad: "/dashboard/suche", zeile: "🔎 Wonach suchst du?", titel: "Suche", pose: "nachdenken",
    text: "Gefunden wird nur, was du in TanzRaum auch sehen darfst." },
  { pfad: "/dashboard/admin", zeile: "🛡️ Plattform-Aufgaben.", titel: "Administration", pose: "erklaeren",
    text: "Ohne Vereins- oder Mitgliederdaten. Mit „Ansicht als …“ siehst du TanzRaum aus Sicht jeder Rolle." },
];

export function tippFuer(pfad: string): KaiTipp | null {
  const passend = KONTEXT_TIPPS.filter((t) => (t.exakt ? pfad === t.pfad : pfad === t.pfad || pfad.startsWith(`${t.pfad}/`)));
  return passend.sort((a, b) => b.pfad.length - a.pfad.length)[0] ?? null;
}

// Hinweise auf neue Funktionen (neueste zuerst)
export const NEUIGKEITEN: KaiNeuigkeit[] = [
  { id: "2026-09-kai", datum: "2026-09-30", titel: "Kai ist da", text: "Dein neuer TanzRaum-Begleiter – mit Einrichtungshilfe und Tipps für jede Seite." },
  { id: "2026-09-suche", datum: "2026-09-30", titel: "Suche in der Kopfzeile", text: "Mitglieder, Termine, Dateien, Nachrichten und mehr – alles mit einer Suche.", aktion: { label: "Suche öffnen", href: "/dashboard/suche" } },
  { id: "2026-09-erinnerungen", datum: "2026-09-30", titel: "Automatische Erinnerungen", text: "TanzRaum erinnert an fällige Beiträge und an die Rückgabe von Kostümen – jeweils nur einmal." },
];
