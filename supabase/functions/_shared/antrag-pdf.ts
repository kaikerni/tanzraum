// Mitgliedsantrag als PDF (Aufbau angelehnt an die klassische Beitrittserklaerung: Kopf mit Logo, Mitgliedsart,
// Abteilungen, Personalien in zwei Spalten, Vereinstexte, Sorgeberechtigte, Unterschriften, Vereinsfelder,
// Fusszeile mit Vorstand/Bank/Register; Seite 2: SEPA-Lastschriftmandat und Foto-Einwilligung).
// Nur Standardschriften (WinAnsi) – Zeichen ausserhalb werden ersetzt.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "npm:pdf-lib@1.17.1";
import {
  type AntragDaten,
  type AntragInhalt,
  FELD_LABEL,
  type FeldSchluessel,
  ibanLesbar,
  kontoinhaberUnterschrift,
  minderjaehrig,
  mitVerein,
  type Unterschriften,
  type Verfahren,
  VERFAHREN_LABEL,
} from "./antrag-vorlage.ts";

export type PdfVerein = {
  name: string;
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  email?: string | null;
  telefon?: string | null;
  webseite?: string | null;
};

export type PdfStatus = {
  eingereichtAm?: string | null;
  angenommenAm?: string | null;
  mitgliedsnummer?: string | null;
  familiennummer?: string | null;
  muster?: boolean;
};

const A4 = { b: 595.28, h: 841.89 };
const RAND = 42;
const BREITE = A4.b - 2 * RAND;
const TINTE = rgb(0.1, 0.12, 0.17);
const GRAU = rgb(0.42, 0.45, 0.52);
const LINIE = rgb(0.55, 0.57, 0.62);
const ROT = rgb(0.88, 0.11, 0.18);

function datumDe(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}
function zeitDe(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${datumDe(iso)}, ${d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })} Uhr`;
}

function datenUrlBytes(url: string | undefined): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(url ?? "");
  if (!m) return null;
  try {
    const bin = atob(m[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

class Schreiber {
  doc: PDFDocument;
  normal!: PDFFont;
  fett!: PDFFont;
  kursiv!: PDFFont;
  seite!: PDFPage;
  y = 0;
  fuss: (seite: PDFPage) => void = () => {};
  fussHoehe = 70;
  private erlaubt = new Map<string, boolean>();

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  async schriften() {
    this.normal = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fett = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.kursiv = await this.doc.embedFont(StandardFonts.HelveticaOblique);
  }

  // Zeichen ohne WinAnsi-Entsprechung ersetzen (sonst bricht pdf-lib ab)
  sauber(s: string): string {
    let aus = "";
    for (const z of s.replace(/\r/g, "")) {
      if (z === "\n") {
        aus += z;
        continue;
      }
      let ok = this.erlaubt.get(z);
      if (ok === undefined) {
        try {
          this.normal.encodeText(z);
          ok = true;
        } catch {
          ok = false;
        }
        this.erlaubt.set(z, ok);
      }
      aus += ok ? z : z === "→" ? "->" : "?";
    }
    return aus;
  }

  neueSeite() {
    this.seite = this.doc.addPage([A4.b, A4.h]);
    this.fuss(this.seite);
    this.y = A4.h - RAND;
  }

  platz(hoehe: number) {
    if (this.y - hoehe < RAND + this.fussHoehe) this.neueSeite();
  }

  umbrechen(textRoh: string, font: PDFFont, groesse: number, breite: number): string[] {
    const zeilen: string[] = [];
    for (const absatz of this.sauber(textRoh).split("\n")) {
      const woerter = absatz.split(/\s+/).filter(Boolean);
      let zeile = "";
      for (const w of woerter) {
        const test = zeile ? `${zeile} ${w}` : w;
        if (font.widthOfTextAtSize(test, groesse) <= breite) zeile = test;
        else {
          if (zeile) zeilen.push(zeile);
          zeile = w;
          while (font.widthOfTextAtSize(zeile, groesse) > breite && zeile.length > 1) {
            let n = zeile.length - 1;
            while (n > 1 && font.widthOfTextAtSize(zeile.slice(0, n), groesse) > breite) n--;
            zeilen.push(zeile.slice(0, n));
            zeile = zeile.slice(n);
          }
        }
      }
      zeilen.push(zeile);
    }
    return zeilen;
  }

  text(s: string, x: number, y: number, o: { font?: PDFFont; groesse?: number; farbe?: ReturnType<typeof rgb> } = {}) {
    this.seite.drawText(this.sauber(s), { x, y, size: o.groesse ?? 10, font: o.font ?? this.normal, color: o.farbe ?? TINTE });
  }

  absatz(s: string, o: { font?: PDFFont; groesse?: number; farbe?: ReturnType<typeof rgb>; x?: number; breite?: number; abstand?: number } = {}) {
    const groesse = o.groesse ?? 9.5;
    const font = o.font ?? this.normal;
    const zeilenhoehe = groesse * 1.32;
    for (const z of this.umbrechen(s, font, groesse, o.breite ?? BREITE)) {
      this.platz(zeilenhoehe);
      this.y -= zeilenhoehe;
      this.text(z, o.x ?? RAND, this.y + 2, { font, groesse, farbe: o.farbe });
    }
    this.y -= o.abstand ?? 6;
  }

  kasten(x: number, y: number, an: boolean) {
    this.seite.drawRectangle({ x, y, width: 8.5, height: 8.5, borderColor: TINTE, borderWidth: 0.8 });
    if (an) {
      this.seite.drawLine({ start: { x: x + 1.6, y: y + 4.3 }, end: { x: x + 3.6, y: y + 1.8 }, thickness: 1.3, color: TINTE });
      this.seite.drawLine({ start: { x: x + 3.6, y: y + 1.8 }, end: { x: x + 7.2, y: y + 7.2 }, thickness: 1.3, color: TINTE });
    }
  }

  // Auswahl mit Kaestchen, fortlaufend umbrechend
  auswahl(eintraege: { label: string; an: boolean }[], groesse = 10) {
    let x = RAND;
    this.platz(18);
    this.y -= 15;
    for (const e of eintraege) {
      const w = this.fett.widthOfTextAtSize(this.sauber(e.label), groesse) + 22;
      if (x + w > RAND + BREITE) {
        x = RAND;
        this.platz(16);
        this.y -= 15;
      }
      this.text(e.label, x, this.y, { groesse });
      this.kasten(x + w - 16, this.y - 1, e.an);
      x += w + 10;
    }
    this.y -= 6;
  }

  // Beschriftetes Feld mit Linie
  feld(label: string, wert: string, x: number, breite: number, labelBreite = 92) {
    this.text(label, x, this.y, { groesse: 9.5, farbe: GRAU });
    const wx = x + labelBreite;
    const inhalt = this.umbrechen(wert, this.normal, 10, breite - labelBreite - 2)[0] ?? "";
    this.text(inhalt, wx + 2, this.y + 1.5, { groesse: 10 });
    this.seite.drawLine({ start: { x: wx, y: this.y - 2.5 }, end: { x: x + breite, y: this.y - 2.5 }, thickness: 0.6, color: LINIE });
  }

  trenner(gestrichelt = false) {
    this.platz(12);
    this.y -= 6;
    this.seite.drawLine({
      start: { x: RAND, y: this.y },
      end: { x: RAND + BREITE, y: this.y },
      thickness: 0.6,
      color: LINIE,
      dashArray: gestrichelt ? [3, 3] : undefined,
    });
    this.y -= 8;
  }

  ueberschrift(s: string, groesse = 12) {
    this.platz(groesse * 2.2);
    this.y -= groesse * 1.5;
    this.text(s, RAND, this.y, { font: this.fett, groesse });
    this.y -= 6;
  }
}

export async function antragPdf(opts: {
  verein: PdfVerein;
  inhalt: AntragInhalt;
  daten: AntragDaten;
  verfahren: Verfahren | null;
  unterschriften: Unterschriften;
  status: PdfStatus;
  logo?: Uint8Array | null;
  heute: string;
}): Promise<Uint8Array> {
  const { verein, inhalt, daten: d, verfahren, unterschriften, status } = opts;
  const doc = await PDFDocument.create();
  doc.setTitle(`${inhalt.titel} – ${verein.name}`);
  doc.setAuthor(verein.name);
  doc.setCreator("TanzRaum");
  doc.setProducer("TanzRaum");
  const s = new Schreiber(doc);
  await s.schriften();
  const vName = verein.name;

  // Logo (PNG/JPEG)
  let logo: PDFImage | null = null;
  if (opts.logo && opts.logo.length > 8) {
    try {
      const b = opts.logo;
      if (b[0] === 0x89 && b[1] === 0x50) logo = await doc.embedPng(b);
      else if (b[0] === 0xff && b[1] === 0xd8) logo = await doc.embedJpg(b);
    } catch {
      logo = null;
    }
  }

  // Unterschriften als Bilder
  const bilder = new Map<string, PDFImage>();
  if (verfahren === "bildschirm") {
    for (const [rolle, u] of Object.entries(unterschriften)) {
      const bytes = datenUrlBytes(u?.bild);
      if (!bytes) continue;
      try {
        bilder.set(rolle, await doc.embedPng(bytes));
      } catch {
        // unlesbare Unterschrift -> Feld bleibt leer
      }
    }
  }

  // Fusszeile: Slogan, Vorstand, Bankverbindungen, Register
  const fussSpalten: string[][] = [];
  for (const v of inhalt.vorstand) fussSpalten.push([v.funktion, v.name, ...v.anschrift.split(/\n|,\s*/), ...v.kontakt.split(/\n/)].filter(Boolean));
  if (inhalt.anschrift || inhalt.kontakt) fussSpalten.push([vName, ...inhalt.kontakt.split("\n")].filter(Boolean));
  for (const b of inhalt.bankverbindungen) fussSpalten.push([b.bezeichnung, b.bank, b.iban ? `IBAN ${ibanLesbar(b.iban)}` : "", b.bic ? `BIC ${b.bic}` : ""].filter(Boolean));
  const fussZeile = [inhalt.register, inhalt.steuernummer ? `Steuernummer ${inhalt.steuernummer}` : "", inhalt.vorstand_26].filter(Boolean).join("   ");
  const spaltenZeilen = Math.min(7, Math.max(0, ...fussSpalten.map((sp) => sp.length)));
  s.fussHoehe = (inhalt.slogan ? 14 : 0) + spaltenZeilen * 8 + (fussZeile ? 12 : 0) + 18;
  s.fuss = (seite) => {
    let y = RAND - 8 + (fussZeile ? 10 : 0) + spaltenZeilen * 8;
    if (inhalt.slogan) {
      seite.drawText(s.sauber(inhalt.slogan), { x: RAND, y: y + 8, size: 11, font: s.kursiv, color: TINTE });
    }
    const spalten = fussSpalten.slice(0, 6);
    const sb = spalten.length ? BREITE / spalten.length : BREITE;
    spalten.forEach((sp, i) => {
      sp.slice(0, 7).forEach((z, j) => {
        const zeile = s.umbrechen(z, j === 0 ? s.fett : s.normal, 6.5, sb - 6)[0] ?? "";
        seite.drawText(zeile, { x: RAND + i * sb, y: y - j * 8, size: 6.5, font: j === 0 ? s.fett : s.normal, color: GRAU });
      });
    });
    if (fussZeile) {
      const z = s.umbrechen(fussZeile, s.normal, 6.5, BREITE)[0] ?? "";
      seite.drawText(z, { x: RAND, y: RAND - 8, size: 6.5, font: s.normal, color: GRAU });
    }
    if (status.muster) {
      seite.drawText("MUSTER", { x: A4.b / 2 - 120, y: A4.h / 2 - 40, size: 90, font: s.fett, color: rgb(0.93, 0.93, 0.95), opacity: 0.6 });
    }
  };

  const kopf = (seitentitel: string) => {
    const logoB = 88;
    if (logo) {
      const f = Math.min(logoB / logo.width, logoB / logo.height);
      s.seite.drawImage(logo, { x: RAND + BREITE - logo.width * f, y: A4.h - RAND - logo.height * f + 6, width: logo.width * f, height: logo.height * f });
    }
    const textBreite = logo ? BREITE - logoB - 12 : BREITE;
    s.y = A4.h - RAND;
    s.absatz(seitentitel, { font: s.fett, groesse: 18, breite: textBreite, abstand: 0 });
    s.absatz("zum", { groesse: 9.5, farbe: GRAU, breite: textBreite, abstand: 0 });
    s.absatz(vName, { font: s.fett, groesse: 17, breite: textBreite, abstand: 1 });
    const anschrift = inhalt.anschrift ||
      [[verein.strasse, verein.hausnummer].filter(Boolean).join(" "), [verein.plz, verein.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (anschrift) s.absatz(anschrift.replace(/\n/g, ", "), { groesse: 10, farbe: GRAU, breite: textBreite, abstand: 0 });
    s.y = Math.min(s.y, A4.h - RAND - logoB) - 8;
  };

  // ------------------------------- Seite 1 --------------------------------
  s.neueSeite();
  kopf(inhalt.titel);

  if (inhalt.mitgliedsarten.length > 0) {
    s.auswahl(
      inhalt.mitgliedsarten.map((a) => ({
        label: a.betrag && d.mitgliedsart === a.name && d.foerderbeitrag ? `${a.name} (Förderbeitrag: ${d.foerderbeitrag})` : a.name,
        an: d.mitgliedsart === a.name,
      })),
    );
  }
  const abteilungen = [...inhalt.abteilungen];
  if (abteilungen.length > 0 || inhalt.abteilung_sonstige) {
    s.auswahl([
      ...abteilungen.map((a) => ({ label: a, an: d.abteilungen.includes(a) })),
      ...(inhalt.abteilung_sonstige ? [{ label: d.abteilung_sonstige ? `Sonstige: ${d.abteilung_sonstige}` : "Sonstige", an: !!d.abteilung_sonstige }] : []),
    ]);
  }

  // Personalien in zwei Spalten
  const links: [string, string][] = [
    ["Name", d.nachname],
    ["Vorname", d.vorname],
    ["Straße", d.strasse],
    ["PLZ / Ort", [d.plz, d.ort].filter(Boolean).join(" ")],
    ["Geburtstag", datumDe(d.geburtsdatum)],
  ];
  const rechts: [string, string][] = [["E-Mail", d.email]];
  const optional = (k: FeldSchluessel) => inhalt.felder[k] !== "aus";
  if (optional("beruf")) links.push([FELD_LABEL.beruf, d.beruf]);
  for (const k of ["telefon", "handy", "fax", "telefon_geschaeftlich", "nationalitaet"] as FeldSchluessel[]) {
    if (optional(k)) rechts.push([FELD_LABEL[k], d[k] as string]);
  }
  s.y -= 8;
  const spalte = (BREITE - 24) / 2;
  for (let i = 0; i < Math.max(links.length, rechts.length); i++) {
    s.platz(22);
    s.y -= 21;
    if (links[i]) s.feld(links[i][0], links[i][1], RAND, spalte, 70);
    if (rechts[i]) s.feld(rechts[i][0], rechts[i][1], RAND + spalte + 24, spalte, 92);
  }
  s.y -= 14;

  // Vereinstexte
  if (inhalt.text_beitrag) s.absatz(mitVerein(inhalt.text_beitrag, vName));
  if (inhalt.text_haftung) s.absatz(mitVerein(inhalt.text_haftung, vName), { font: s.kursiv });
  if (inhalt.text_datenschutz) s.absatz(mitVerein(inhalt.text_datenschutz, vName), { groesse: 8.5, farbe: GRAU });

  // Sorgeberechtigte
  const minderj = minderjaehrig(d.geburtsdatum, opts.heute);
  if (minderj || d.sorgeberechtigte.length > 0) {
    s.absatz(mitVerein(inhalt.text_minderjaehrige, vName), { abstand: 2 });
    s.platz(24);
    s.y -= 18;
    s.feld("Name, Vorname", d.sorgeberechtigte[0]?.name ?? "", RAND, spalte, 78);
    s.feld("Name, Vorname", d.sorgeberechtigte[1]?.name ?? "", RAND + spalte + 24, spalte, 78);
    s.y -= 10;
  }

  // Ort, Datum, Unterschriften
  const unterschriftFeld = (rolle: string, label: string, x: number, breite: number) => {
    const bild = bilder.get(rolle);
    const u = unterschriften[rolle as keyof Unterschriften];
    const linieY = s.y;
    if (bild) {
      const f = Math.min((breite - 10) / bild.width, 34 / bild.height);
      s.seite.drawImage(bild, { x: x + 4, y: linieY + 1, width: bild.width * f, height: bild.height * f });
    } else if (verfahren === "bestaetigung" && u?.name) {
      s.text(`bestätigt: ${u.name}`, x + 4, linieY + 6, { font: s.kursiv, groesse: 10 });
    }
    s.seite.drawLine({ start: { x, y: linieY }, end: { x: x + breite, y: linieY }, thickness: 0.7, color: TINTE });
    s.text(label, x, linieY - 9, { groesse: 7.5, farbe: GRAU });
    if (u?.zeitpunkt && (bild || u.name)) s.text(zeitDe(u.zeitpunkt), x, linieY - 17, { groesse: 7, farbe: GRAU });
  };

  s.platz(95);
  s.y -= 20;
  s.feld("Ort, Datum", [d.unterschrift_ort, datumDe(status.eingereichtAm ?? null)].filter(Boolean).join(", "), RAND, spalte, 70);
  s.y -= 46;
  const unterzeichner = ["mitglied", ...(minderj && d.sorgeberechtigte[0] ? ["sorge1"] : []), ...(minderj && d.sorgeberechtigte[1] ? ["sorge2"] : [])];
  const ub = (BREITE - (unterzeichner.length - 1) * 16) / unterzeichner.length;
  unterzeichner.forEach((r, i) =>
    unterschriftFeld(r, r === "mitglied" ? (minderj ? "Unterschrift Mitglied (Minderjährige/r)" : "Unterschrift Mitglied") : `Unterschrift Sorgeberechtigte(r) ${r === "sorge1" ? 1 : 2}`, RAND + i * (ub + 16), ub),
  );
  s.y -= 28;

  if (inhalt.vereinsfelder) {
    s.trenner(true);
    s.platz(20);
    s.y -= 10;
    s.feld("Mitgliedsnummer", status.mitgliedsnummer ?? "", RAND, 190, 82);
    s.feld("Familiennummer", status.familiennummer ?? "", RAND + 214, 190, 82);
    s.text("(wird vom Verein eingetragen)", RAND + 420, s.y, { groesse: 8, farbe: GRAU });
    s.y -= 10;
  }

  // Nachweis (Seite 1, unter den Vereinsfeldern)
  const nachweis = [
    status.eingereichtAm ? `Eingereicht über TanzRaum am ${zeitDe(status.eingereichtAm)}` : status.muster ? "Muster – Vorschau des Vereinsformulars" : "Noch nicht eingereicht",
    verfahren ? `Unterschrift: ${VERFAHREN_LABEL[verfahren]}` : "",
    status.angenommenAm ? `Aufgenommen am ${datumDe(status.angenommenAm)}` : "",
  ].filter(Boolean);
  s.platz(30);
  s.y -= 12;
  s.absatz(nachweis.join("   ·   "), { groesse: 7.5, farbe: status.angenommenAm ? ROT : GRAU, abstand: 0 });
  if (verfahren === "bildschirm" || verfahren === "bestaetigung") {
    s.absatz(
      "Hinweis: Die elektronische Unterschrift bildet das vom Verein gewählte Verfahren ab. Ob sie für jeden Zweck (z. B. ein SEPA-Lastschriftmandat) ausreicht, entscheidet der Verein bzw. dessen Kreditinstitut.",
      { groesse: 7, farbe: GRAU, abstand: 0 },
    );
  }

  // ------------------------------- Seite 2 --------------------------------
  if (inhalt.sepa_aktiv || inhalt.foto_aktiv) {
    s.neueSeite();
    kopf(`${inhalt.titel} – Seite 2`);

    if (inhalt.sepa_aktiv) {
      s.ueberschrift("SEPA-Lastschriftmandat");
      s.absatz(`Gläubiger-Identifikationsnummer ${inhalt.glaeubiger_id || "__________________"}`, { font: s.fett, abstand: 1 });
      s.absatz("Mandatsreferenz (wird separat mitgeteilt)", { font: s.fett, abstand: 5 });
      s.absatz(mitVerein(inhalt.text_sepa, vName));
      s.absatz(`Zahlungsart: ${inhalt.sepa_zahlungsart}`, { abstand: 4 });
      const zeilen: [string, string][] = [
        ["Kontoinhaber", d.sepa_kontoinhaber],
        ["Straße und Hausnummer", d.sepa_strasse || (d.sepa_kontoinhaber ? d.strasse : "")],
        ["Postleitzahl und Ort", d.sepa_plz_ort || (d.sepa_kontoinhaber ? [d.plz, d.ort].filter(Boolean).join(" ") : "")],
        ["Kreditinstitut (Name)", d.sepa_bank],
        ["IBAN", d.sepa_iban ? ibanLesbar(d.sepa_iban) : ""],
        ["BIC", d.sepa_bic],
      ];
      for (const [l, w] of zeilen) {
        s.platz(18);
        s.y -= 17;
        s.feld(l, w, RAND, BREITE, 130);
      }
      // Ort/Datum und Unterschrift nebeneinander
      s.platz(62);
      s.y -= 42;
      s.feld("Ort, Datum", [d.unterschrift_ort, datumDe(status.eingereichtAm ?? null)].filter(Boolean).join(", "), RAND, spalte, 70);
      const wer = kontoinhaberUnterschrift(d);
      unterschriftFeld(wer, `Unterschrift Kontoinhaber(in)${d.sepa_kontoinhaber ? ` – ${d.sepa_kontoinhaber}` : ""}`, RAND + spalte + 24, spalte);
      s.y -= 24;
    }

    if (inhalt.foto_aktiv) {
      if (inhalt.sepa_aktiv) s.trenner(true);
      s.ueberschrift("Einwilligung zur Verwendung von Personenabbildungen");
      s.absatz(
        `Hiermit willige ich, ${[d.vorname, d.nachname].filter(Boolean).join(" ") || "____________________"}` +
          (d.strasse ? `, wohnhaft ${d.strasse}, ${[d.plz, d.ort].filter(Boolean).join(" ")}` : "") +
          (d.geburtsdatum ? `, geb. am ${datumDe(d.geburtsdatum)}` : "") +
          (minderj && d.sorgeberechtigte.length ? ` – vertreten durch ${d.sorgeberechtigte.map((x) => x.name).join(" und ")} –` : "") +
          " in Folgendes ein:",
        { abstand: 4 },
      );
      s.absatz(mitVerein(inhalt.text_foto, vName));
      s.auswahl([
        { label: "Ja, ich willige ein", an: d.foto === "ja" },
        { label: "Nein, ich willige nicht ein", an: d.foto === "nein" },
      ]);
      s.platz(56);
      s.y -= 38;
      const fotoUnterzeichner = minderj ? ["sorge1", "mitglied"] : ["mitglied"];
      const fb = (BREITE - (fotoUnterzeichner.length - 1) * 16) / fotoUnterzeichner.length;
      fotoUnterzeichner.forEach((r, i) =>
        unterschriftFeld(r, r === "mitglied" ? (minderj ? "Unterschrift Minderjährige(r)" : "Unterschrift") : "Unterschrift Sorgeberechtigte(r)", RAND + i * (fb + 16), fb),
      );
      s.y -= 26;
    }
  }

  return await doc.save();
}
