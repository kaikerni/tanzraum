// Mitgliedsantrag: Aufbau der Vereinsvorlage, Beispieltexte, Pruefregeln.
// Ohne Abhaengigkeiten – wird von der Edge Function (PDF) UND von der Next-App (Formular, Editor) genutzt,
// damit Formular, Pruefung und PDF immer dieselben Regeln und Texte verwenden.
// Platzhalter in Texten: {verein} = Vereinsname.

export type FeldStatus = "aus" | "optional" | "pflicht";
export type FeldSchluessel = "telefon" | "handy" | "telefon_geschaeftlich" | "fax" | "beruf" | "nationalitaet";
// "extern" = eigenes Verfahren des Vereins (z. B. persoenlich, Vereinswebseite); "bestehend" = bereits Mitglied, nur Bestaetigung
export type Verfahren = "bildschirm" | "bestaetigung" | "papier" | "extern" | "bestehend";
// Vom Verein freischaltbare Verfahren fuer neue Mitglieder ("bestehend" steuert eine eigene Einstellung)
export const WAEHLBARE_VERFAHREN: Verfahren[] = ["bildschirm", "bestaetigung", "papier", "extern"];
export type Benachrichtigung = "keine" | "app" | "app_email";

export type Vorstandsmitglied = { funktion: string; name: string; anschrift: string; kontakt: string };
export type Bankverbindung = { bezeichnung: string; bank: string; iban: string; bic: string };
export type Mitgliedsart = { name: string; betrag: boolean };

export type AntragInhalt = {
  titel: string;
  slogan: string;
  anschrift: string;
  kontakt: string;
  vorstand: Vorstandsmitglied[];
  vorstand_26: string;
  register: string;
  steuernummer: string;
  bankverbindungen: Bankverbindung[];
  mitgliedsarten: Mitgliedsart[];
  abteilungen: string[];
  abteilung_sonstige: boolean;
  felder: Record<FeldSchluessel, FeldStatus>;
  text_beitrag: string;
  text_haftung: string;
  text_minderjaehrige: string;
  text_datenschutz: string;
  sepa_aktiv: boolean;
  glaeubiger_id: string;
  sepa_zahlungsart: string;
  text_sepa: string;
  foto_aktiv: boolean;
  text_foto: string;
  vereinsfelder: boolean;
};

export type AntragEinstellungen = {
  antrag_erforderlich: boolean;
  verfahren: Verfahren[];
  empfaenger_email: string;
  kopie_an_antragsteller: boolean;
  hinzufuegen_benachrichtigung: Benachrichtigung;
  hinzufuegen_text: string;
  annahme_benachrichtigung: Benachrichtigung;
  annahme_text: string;
  auto_freischalten: boolean;
  aufnahme_pdf_speichern: boolean;
  ablehnung_benachrichtigung: Benachrichtigung;
  ablehnung_text: string;
  // Bestehende Mitglieder bestaetigen nur ihre Mitgliedschaft statt eines neuen Antrags
  bestehende_bestaetigen: boolean;
  // Externes Verfahren: Beschreibung und optionaler Link (z. B. Vereinswebseite)
  extern_text: string;
  extern_link: string;
};

export type Sorgeberechtigte = { name: string };
export type AntragDaten = {
  mitgliedsart: string;
  foerderbeitrag: string;
  abteilungen: string[];
  abteilung_sonstige: string;
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  geburtsdatum: string;
  email: string;
  telefon: string;
  handy: string;
  telefon_geschaeftlich: string;
  fax: string;
  beruf: string;
  nationalitaet: string;
  sorgeberechtigte: Sorgeberechtigte[];
  sepa_erteilt: boolean;
  sepa_kontoinhaber: string;
  sepa_strasse: string;
  sepa_plz_ort: string;
  sepa_bank: string;
  sepa_iban: string;
  sepa_bic: string;
  foto: "" | "ja" | "nein";
  bestaetigt: boolean;
  unterschrift_ort: string;
  bestehend_bestaetigt: boolean;
  mitglied_seit: string;
};

export type Unterschrift = { bild?: string; name?: string; zeitpunkt: string };
export type Unterschriften = Partial<Record<"mitglied" | "sorge1" | "sorge2" | "kontoinhaber", Unterschrift>>;

export const FELD_LABEL: Record<FeldSchluessel, string> = {
  telefon: "Telefon privat",
  handy: "Handy",
  telefon_geschaeftlich: "Telefon geschäftlich",
  fax: "Fax privat",
  beruf: "Beruf",
  nationalitaet: "Nationalität",
};

export const VERFAHREN_LABEL: Record<Verfahren, string> = {
  bildschirm: "Unterschrift auf dem Bildschirm",
  bestaetigung: "Name eintragen und bestätigen",
  papier: "Ausdrucken, unterschreiben und abgeben",
  extern: "Verfahren des Vereins (extern / persönlich)",
  bestehend: "Bestehende Mitgliedschaft bestätigt",
};

// ---------------------------------------------------------------------------------------------
// Beispieltexte (der Verein passt alles an)
// ---------------------------------------------------------------------------------------------
export const STANDARD_INHALT: AntragInhalt = {
  titel: "Beitrittserklärung",
  slogan: "",
  anschrift: "",
  kontakt: "",
  vorstand: [],
  vorstand_26: "",
  register: "",
  steuernummer: "",
  bankverbindungen: [],
  mitgliedsarten: [
    { name: "Mitglied", betrag: false },
    { name: "Förderndes Mitglied", betrag: true },
  ],
  abteilungen: [],
  abteilung_sonstige: true,
  felder: { telefon: "optional", handy: "optional", telefon_geschaeftlich: "aus", fax: "aus", beruf: "aus", nationalitaet: "aus" },
  text_beitrag:
    "Der Beitrag ist ab 1. Januar eines Jahres bzw. ab Eintritt für das laufende Jahr fällig. Er wird per SEPA-Lastschrift nach Rechnungsstellung eingezogen. Mitgliedsbeiträge und Aufnahmegebühren entnehmen Sie bitte der zurzeit gültigen Beitragsordnung. Eine gültige Satzung habe ich erhalten.",
  text_haftung:
    "Mit der Genehmigung durch alle Personensorgeberechtigten übernehmen die bzw. übernimmt der Unterzeichnende die Haftung für die Beitragspflicht. Mit der Unterzeichnung bzw. Genehmigung durch die Personensorgeberechtigten werden die Satzung sowie alle Vereinsordnungen, insbesondere die Beitragsordnung, anerkannt. Alle Ordnungen sind auf der Homepage oder in der Geschäftsstelle erhältlich.",
  text_minderjaehrige: "Bei Minderjährigen bitte zusätzlich die Namen aller Personensorgeberechtigten angeben.",
  text_datenschutz:
    "{verein} verarbeitet die angegebenen Daten zur Durchführung der Mitgliedschaft (Art. 6 Abs. 1 lit. b DSGVO), für den Beitragseinzug und die Vereinsverwaltung. Die Daten werden nach Ende der Mitgliedschaft gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten bestehen. Weitere Informationen enthält die Datenschutzerklärung des Vereins.",
  sepa_aktiv: true,
  glaeubiger_id: "",
  sepa_zahlungsart: "Wiederkehrende Zahlung",
  text_sepa:
    "Ich ermächtige {verein}, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die von {verein} auf mein Konto gezogenen Lastschriften einzulösen.\nHinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen. Die Mandatsreferenz wird separat mitgeteilt.",
  foto_aktiv: true,
  text_foto:
    "Ich willige in die Anfertigung, Nutzung und Veröffentlichung von Fotos meiner Person bzw. meines minderjährigen Kindes durch {verein} oder durch beauftragte Fotografen ein – zur Veröffentlichung in den Publikationen des Vereins sowie im Internet auf den Internetseiten und Social-Media-Kanälen des Vereins. Die Einräumung der Rechte erfolgt ohne Vergütung und umfasst das Recht zur Bearbeitung, soweit sie nicht entstellend ist. Mir ist bekannt, dass digitale Bilder aus dem Internet kopiert und verändert werden können, ohne dass der Verein darauf Einfluss hat. Die Einwilligung ist freiwillig und bei Einzelabbildungen jederzeit für die Zukunft widerruflich.",
  vereinsfelder: true,
};

export const STANDARD_EINSTELLUNGEN: AntragEinstellungen = {
  antrag_erforderlich: true,
  verfahren: ["bildschirm", "papier"],
  empfaenger_email: "",
  kopie_an_antragsteller: true,
  hinzufuegen_benachrichtigung: "app_email",
  hinzufuegen_text: "Der Verein {verein} hat dich als neues Mitglied hinzugefügt. Bitte fülle unter „Mitgliedsantrag“ den Antrag aus.",
  annahme_benachrichtigung: "app_email",
  annahme_text: "Willkommen im Verein {verein}! Dein Mitgliedsantrag wurde angenommen.",
  auto_freischalten: true,
  aufnahme_pdf_speichern: true,
  ablehnung_benachrichtigung: "app",
  ablehnung_text: "Dein Mitgliedsantrag beim Verein {verein} wurde leider nicht angenommen.",
  bestehende_bestaetigen: true,
  extern_text: "",
  extern_link: "",
};

export const LEERE_DATEN: AntragDaten = {
  mitgliedsart: "",
  foerderbeitrag: "",
  abteilungen: [],
  abteilung_sonstige: "",
  vorname: "",
  nachname: "",
  strasse: "",
  plz: "",
  ort: "",
  geburtsdatum: "",
  email: "",
  telefon: "",
  handy: "",
  telefon_geschaeftlich: "",
  fax: "",
  beruf: "",
  nationalitaet: "",
  sorgeberechtigte: [],
  sepa_erteilt: false,
  sepa_kontoinhaber: "",
  sepa_strasse: "",
  sepa_plz_ort: "",
  sepa_bank: "",
  sepa_iban: "",
  sepa_bic: "",
  foto: "",
  bestaetigt: false,
  unterschrift_ort: "",
  bestehend_bestaetigt: false,
  mitglied_seit: "",
};

// ---------------------------------------------------------------------------------------------
// Zusammenfuehren (gespeicherte Werte ueber Standard, Typen abgesichert)
// ---------------------------------------------------------------------------------------------
type Roh = Record<string, unknown>;
const istObjekt = (x: unknown): x is Roh => typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown, max: number, standard = "") => (typeof x === "string" ? x.slice(0, max) : standard);
const bool = (x: unknown, standard: boolean) => (typeof x === "boolean" ? x : standard);
const liste = <T>(x: unknown, max: number, f: (e: unknown) => T | null): T[] =>
  Array.isArray(x) ? (x.map(f).filter((e) => e !== null) as T[]).slice(0, max) : [];
const benachrichtigung = (x: unknown, standard: Benachrichtigung): Benachrichtigung =>
  x === "keine" || x === "app" || x === "app_email" ? x : standard;

export function inhaltAus(roh: unknown): AntragInhalt {
  const r = istObjekt(roh) ? roh : {};
  const s = STANDARD_INHALT;
  const felder = { ...s.felder };
  if (istObjekt(r.felder)) {
    for (const k of Object.keys(felder) as FeldSchluessel[]) {
      const w = r.felder[k];
      if (w === "aus" || w === "optional" || w === "pflicht") felder[k] = w;
    }
  }
  return {
    titel: text(r.titel, 80, s.titel) || s.titel,
    slogan: text(r.slogan, 120),
    anschrift: text(r.anschrift, 300),
    kontakt: text(r.kontakt, 300),
    vorstand: liste(r.vorstand, 8, (e) =>
      istObjekt(e) ? { funktion: text(e.funktion, 60), name: text(e.name, 80), anschrift: text(e.anschrift, 160), kontakt: text(e.kontakt, 160) } : null,
    ),
    vorstand_26: text(r.vorstand_26, 300),
    register: text(r.register, 120),
    steuernummer: text(r.steuernummer, 60),
    bankverbindungen: liste(r.bankverbindungen, 4, (e) =>
      istObjekt(e) ? { bezeichnung: text(e.bezeichnung, 60), bank: text(e.bank, 80), iban: text(e.iban, 42), bic: text(e.bic, 15) } : null,
    ),
    mitgliedsarten: "mitgliedsarten" in r
      ? liste(r.mitgliedsarten, 8, (e) => (istObjekt(e) && text(e.name, 60).trim() ? { name: text(e.name, 60).trim(), betrag: bool(e.betrag, false) } : null))
      : s.mitgliedsarten,
    abteilungen: liste(r.abteilungen, 30, (e) => (typeof e === "string" && e.trim() ? e.trim().slice(0, 60) : null)),
    abteilung_sonstige: bool(r.abteilung_sonstige, s.abteilung_sonstige),
    felder,
    text_beitrag: text(r.text_beitrag, 3000, s.text_beitrag),
    text_haftung: text(r.text_haftung, 3000, s.text_haftung),
    text_minderjaehrige: text(r.text_minderjaehrige, 500, s.text_minderjaehrige),
    text_datenschutz: text(r.text_datenschutz, 3000, s.text_datenschutz),
    sepa_aktiv: bool(r.sepa_aktiv, s.sepa_aktiv),
    glaeubiger_id: text(r.glaeubiger_id, 35),
    sepa_zahlungsart: text(r.sepa_zahlungsart, 60, s.sepa_zahlungsart) || s.sepa_zahlungsart,
    text_sepa: text(r.text_sepa, 3000, s.text_sepa),
    foto_aktiv: bool(r.foto_aktiv, s.foto_aktiv),
    text_foto: text(r.text_foto, 4000, s.text_foto),
    vereinsfelder: bool(r.vereinsfelder, s.vereinsfelder),
  };
}

export function einstellungenAus(roh: unknown): AntragEinstellungen {
  const r = istObjekt(roh) ? roh : {};
  const s = STANDARD_EINSTELLUNGEN;
  const verfahren = liste(r.verfahren, 4, (e) => (WAEHLBARE_VERFAHREN.includes(e as Verfahren) ? (e as Verfahren) : null));
  return {
    antrag_erforderlich: bool(r.antrag_erforderlich, s.antrag_erforderlich),
    verfahren: verfahren.length > 0 ? [...new Set(verfahren)] : s.verfahren,
    empfaenger_email: text(r.empfaenger_email, 200).trim(),
    kopie_an_antragsteller: bool(r.kopie_an_antragsteller, s.kopie_an_antragsteller),
    hinzufuegen_benachrichtigung: benachrichtigung(r.hinzufuegen_benachrichtigung, s.hinzufuegen_benachrichtigung),
    hinzufuegen_text: text(r.hinzufuegen_text, 500, s.hinzufuegen_text) || s.hinzufuegen_text,
    annahme_benachrichtigung: benachrichtigung(r.annahme_benachrichtigung, s.annahme_benachrichtigung),
    annahme_text: text(r.annahme_text, 500, s.annahme_text) || s.annahme_text,
    auto_freischalten: bool(r.auto_freischalten, s.auto_freischalten),
    aufnahme_pdf_speichern: bool(r.aufnahme_pdf_speichern, s.aufnahme_pdf_speichern),
    ablehnung_benachrichtigung: benachrichtigung(r.ablehnung_benachrichtigung, s.ablehnung_benachrichtigung),
    ablehnung_text: text(r.ablehnung_text, 500, s.ablehnung_text) || s.ablehnung_text,
    bestehende_bestaetigen: bool(r.bestehende_bestaetigen, s.bestehende_bestaetigen),
    extern_text: text(r.extern_text, 1000).trim(),
    extern_link: /^https:\/\/\S+$/.test(text(r.extern_link, 300).trim()) ? text(r.extern_link, 300).trim() : "",
  };
}

export function datenAus(roh: unknown): AntragDaten {
  const r = istObjekt(roh) ? roh : {};
  const t = (k: keyof AntragDaten, max = 120) => text(r[k], max).trim();
  return {
    mitgliedsart: t("mitgliedsart", 60),
    foerderbeitrag: t("foerderbeitrag", 30),
    abteilungen: liste(r.abteilungen, 30, (e) => (typeof e === "string" && e.trim() ? e.trim().slice(0, 60) : null)),
    abteilung_sonstige: t("abteilung_sonstige", 80),
    vorname: t("vorname", 80),
    nachname: t("nachname", 80),
    strasse: t("strasse", 120),
    plz: t("plz", 10),
    ort: t("ort", 80),
    geburtsdatum: /^\d{4}-\d{2}-\d{2}$/.test(t("geburtsdatum", 10)) ? t("geburtsdatum", 10) : "",
    email: t("email", 200),
    telefon: t("telefon", 40),
    handy: t("handy", 40),
    telefon_geschaeftlich: t("telefon_geschaeftlich", 40),
    fax: t("fax", 40),
    beruf: t("beruf", 80),
    nationalitaet: t("nationalitaet", 60),
    sorgeberechtigte: liste(r.sorgeberechtigte, 2, (e) => (istObjekt(e) && text(e.name, 120).trim() ? { name: text(e.name, 120).trim() } : null)),
    sepa_erteilt: bool(r.sepa_erteilt, false),
    sepa_kontoinhaber: t("sepa_kontoinhaber", 120),
    sepa_strasse: t("sepa_strasse", 120),
    sepa_plz_ort: t("sepa_plz_ort", 120),
    sepa_bank: t("sepa_bank", 120),
    sepa_iban: t("sepa_iban", 42).replace(/\s+/g, "").toUpperCase(),
    sepa_bic: t("sepa_bic", 15).replace(/\s+/g, "").toUpperCase(),
    foto: r.foto === "ja" || r.foto === "nein" ? r.foto : "",
    bestaetigt: bool(r.bestaetigt, false),
    unterschrift_ort: t("unterschrift_ort", 80),
    bestehend_bestaetigt: bool(r.bestehend_bestaetigt, false),
    mitglied_seit: t("mitglied_seit", 40),
  };
}

// ---------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------
export function mitVerein(textMitPlatzhalter: string, vereinName: string): string {
  return textMitPlatzhalter.replaceAll("{verein}", vereinName);
}

export function ibanGueltig(iban: string): boolean {
  const i = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(i)) return false;
  const umgestellt = i.slice(4) + i.slice(0, 4);
  let rest = 0;
  for (const z of umgestellt) {
    const wert = z >= "A" && z <= "Z" ? String(z.charCodeAt(0) - 55) : z;
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

export function ibanLesbar(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

// Minderjaehrig am Stichtag (YYYY-MM-DD)
export function minderjaehrig(geburtsdatum: string, heute: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(geburtsdatum)) return false;
  const [j, m, t] = geburtsdatum.split("-").map(Number);
  const volljaehrig = `${String(j + 18).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
  return volljaehrig > heute;
}

// Welche Unterschriften braucht der Antrag? (Kontoinhaber nur, wenn er keine der anderen Personen ist)
export function benoetigteUnterschriften(inhalt: AntragInhalt, d: AntragDaten, heute: string): ("mitglied" | "sorge1" | "sorge2" | "kontoinhaber")[] {
  const liste: ("mitglied" | "sorge1" | "sorge2" | "kontoinhaber")[] = ["mitglied"];
  if (minderjaehrig(d.geburtsdatum, heute)) {
    if (d.sorgeberechtigte[0]) liste.push("sorge1");
    if (d.sorgeberechtigte[1]) liste.push("sorge2");
  }
  if (inhalt.sepa_aktiv && d.sepa_kontoinhaber && kontoinhaberUnterschrift(d) === "kontoinhaber") liste.push("kontoinhaber");
  return liste;
}

// Wer unterschreibt das SEPA-Mandat: dieselbe Person wie Mitglied/Sorgeberechtigte oder eine eigene Unterschrift
export function kontoinhaberUnterschrift(d: AntragDaten): "mitglied" | "sorge1" | "sorge2" | "kontoinhaber" {
  const gleich = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
  const inhaber = d.sepa_kontoinhaber;
  if (!inhaber) return "mitglied";
  if (gleich(inhaber, `${d.vorname} ${d.nachname}`) || gleich(inhaber, `${d.nachname} ${d.vorname}`) || gleich(inhaber, `${d.nachname}, ${d.vorname}`)) return "mitglied";
  if (d.sorgeberechtigte[0] && gleich(inhaber, d.sorgeberechtigte[0].name)) return "sorge1";
  if (d.sorgeberechtigte[1] && gleich(inhaber, d.sorgeberechtigte[1].name)) return "sorge2";
  return "kontoinhaber";
}

export const UNTERSCHRIFT_LABEL: Record<"mitglied" | "sorge1" | "sorge2" | "kontoinhaber", string> = {
  mitglied: "Mitglied",
  sorge1: "Sorgeberechtigte(r) 1",
  sorge2: "Sorgeberechtigte(r) 2",
  kontoinhaber: "Kontoinhaber(in)",
};

// Pruefung vor dem Einreichen. Rueckgabe: Fehlermeldung oder null.
export function pruefeAntrag(
  inhalt: AntragInhalt,
  d: AntragDaten,
  verfahren: Verfahren | "",
  unterschriften: Unterschriften,
  heute: string,
  erlaubt: Verfahren[],
): string | null {
  if (verfahren === "bestehend") {
    // Bereits Mitglied: nur Name, E-Mail und ausdrueckliche Bestaetigung
    if (!erlaubt.includes("bestehend")) return "Der Verein verlangt auch von bestehenden Mitgliedern den Mitgliedsantrag.";
    if (!d.vorname || !d.nachname) return "Bitte Vor- und Nachnamen angeben.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "Bitte eine gültige E-Mail-Adresse angeben.";
    if (!d.bestehend_bestaetigt) return "Bitte bestätigen, dass du bereits Mitglied im Verein bist.";
    return null;
  }
  if (inhalt.mitgliedsarten.length > 0) {
    const art = inhalt.mitgliedsarten.find((a) => a.name === d.mitgliedsart);
    if (!art) return "Bitte die Art der Mitgliedschaft wählen.";
    if (art.betrag && !d.foerderbeitrag) return "Bitte den Förderbeitrag angeben.";
  }
  if (!d.vorname || !d.nachname) return "Bitte Vor- und Nachnamen angeben.";
  if (!d.strasse || !d.plz || !d.ort) return "Bitte die vollständige Anschrift angeben.";
  if (!d.geburtsdatum || d.geburtsdatum > heute) return "Bitte ein gültiges Geburtsdatum angeben.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "Bitte eine gültige E-Mail-Adresse angeben.";
  for (const k of Object.keys(inhalt.felder) as FeldSchluessel[]) {
    if (inhalt.felder[k] === "pflicht" && !d[k]) return `Bitte „${FELD_LABEL[k]}“ angeben.`;
  }
  if (minderjaehrig(d.geburtsdatum, heute) && d.sorgeberechtigte.length === 0) {
    return "Bei Minderjährigen bitte mindestens eine sorgeberechtigte Person angeben.";
  }
  if (inhalt.sepa_aktiv) {
    if (!d.sepa_erteilt) return "Bitte das SEPA-Lastschriftmandat erteilen.";
    if (!d.sepa_kontoinhaber) return "Bitte den Kontoinhaber angeben.";
    if (!ibanGueltig(d.sepa_iban)) return "Bitte eine gültige IBAN angeben.";
  }
  if (inhalt.foto_aktiv && !d.foto) return "Bitte bei der Foto-Einwilligung „Ja“ oder „Nein“ wählen.";
  if (!d.bestaetigt) return "Bitte bestätigen, dass du die Texte gelesen hast.";
  if (!verfahren || !erlaubt.includes(verfahren)) return "Bitte wählen, wie du unterschreibst.";
  if (verfahren !== "papier" && verfahren !== "extern") {
    for (const rolle of benoetigteUnterschriften(inhalt, d, heute)) {
      const u = unterschriften[rolle];
      if (verfahren === "bildschirm" && !(u?.bild ?? "").startsWith("data:image/png;base64,")) {
        return `Bitte im Feld „Unterschrift ${UNTERSCHRIFT_LABEL[rolle]}“ unterschreiben.`;
      }
      if (verfahren === "bestaetigung" && !(u?.name ?? "").trim()) {
        return `Bitte bei „${UNTERSCHRIFT_LABEL[rolle]}“ den Namen zur Bestätigung eintragen.`;
      }
    }
  }
  return null;
}
