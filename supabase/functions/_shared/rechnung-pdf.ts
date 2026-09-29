// TanzRaum-Rechnung als PDF (A4, DIN-5008-nah): Logo, Aussteller (Stand bei Rechnungserstellung), Empfaenger,
// Rechnungsnummer/-datum, Leistungszeitraum, Posten, Summe, Steuerhinweis (Kleinunternehmer oder USt), Zahlart, Fusszeile.
// Mehrere Rechnungen ergeben ein PDF mit je einer Seite pro Rechnung (Sammel-Download).
// Nur Standardschriften (WinAnsi) – Zeichen ausserhalb werden ersetzt.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "npm:pdf-lib@1.17.1";

export type Aussteller = {
  name?: string | null;
  unternehmen?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
  email?: string | null;
  telefon?: string | null;
  steuernummer?: string | null;
  ust_id?: string | null;
  kleinunternehmer?: boolean | null;
  kleinunternehmer_hinweis?: string | null;
};

export type RechnungDaten = {
  nummer: string;
  rechnungsdatum: string;
  empfaenger_name: string;
  empfaenger_adresse: string | null;
  empfaenger_email: string;
  leistung: string;
  zeitraum: string | null;
  betrag: number | string;
  zahlungsweg: string;
  leistung_von: string | null;
  leistung_bis: string | null;
  aussteller: Aussteller | null;
  anonymisiert_am?: string | null;
};

const A4 = { b: 595.28, h: 841.89 };
const RAND = 56;
const BREITE = A4.b - 2 * RAND;
const TINTE = rgb(0.106, 0.129, 0.188);
const GRAU = rgb(0.373, 0.404, 0.471);
const LINIE = rgb(0.902, 0.91, 0.933);
const ROT = rgb(0.882, 0.114, 0.18);

// zahlungsweg aus stripe-webhook ("lastschrift (stripe)", "karte/lastschrift (stripe)"), paypal-webhook ("paypal") oder manuell
export function zahlungsartText(w: unknown): string {
  const z = String(w ?? "").toLowerCase();
  if (z === "paypal") return "PayPal";
  if (z.startsWith("lastschrift")) return "SEPA-Lastschrift (Stripe)";
  if (z.includes("stripe")) return "Karte oder SEPA-Lastschrift (Stripe)";
  return "Überweisung";
}

export const euro = (n: unknown) =>
  Number(n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export const datumDe = (d: string | null | undefined) => {
  if (!d) return "";
  const t = new Date(`${String(d).slice(0, 10)}T12:00:00Z`);
  return t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
};

export function dateiname(nummer: string): string {
  return `TanzRaum-Rechnung-${nummer.replace(/[^A-Za-z0-9-]/g, "_")}.pdf`;
}

class Zeichner {
  normal!: PDFFont;
  fett!: PDFFont;
  private erlaubt = new Map<string, boolean>();

  async init(doc: PDFDocument) {
    this.normal = await doc.embedFont(StandardFonts.Helvetica);
    this.fett = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  sauber(s: string): string {
    let aus = "";
    for (const z of String(s ?? "").replace(/\r/g, "")) {
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
      aus += ok ? z : "?";
    }
    return aus;
  }

  // Text mit Zeilenumbruch; gibt die neue y-Position zurueck
  text(seite: PDFPage, t: string, x: number, y: number, o: { groesse?: number; fett?: boolean; farbe?: ReturnType<typeof rgb>; breite?: number; rechts?: boolean; abstand?: number } = {}): number {
    const groesse = o.groesse ?? 10;
    const font = o.fett ? this.fett : this.normal;
    const zeilen: string[] = [];
    for (const absatz of this.sauber(t).split("\n")) {
      if (!o.breite) {
        zeilen.push(absatz);
        continue;
      }
      let zeile = "";
      for (const wort of absatz.split(" ")) {
        const test = zeile ? `${zeile} ${wort}` : wort;
        if (font.widthOfTextAtSize(test, groesse) <= o.breite || !zeile) zeile = test;
        else {
          zeilen.push(zeile);
          zeile = wort;
        }
      }
      zeilen.push(zeile);
    }
    let yy = y;
    for (const z of zeilen) {
      const w = font.widthOfTextAtSize(z, groesse);
      seite.drawText(z, { x: o.rechts ? x - w : x, y: yy, size: groesse, font, color: o.farbe ?? TINTE });
      yy -= groesse * (o.abstand ?? 1.4);
    }
    return yy;
  }
}

function adresseZeilen(a: string | null): string[] {
  if (!a) return [];
  return a.split(/\s*,\s*|\n/).map((s) => s.trim()).filter(Boolean);
}

function seiteZeichnen(doc: PDFDocument, z: Zeichner, r: RechnungDaten, logo: PDFImage | null) {
  const s = doc.addPage([A4.b, A4.h]);
  const a: Aussteller = r.aussteller ?? {};
  const firma = [a.name, a.unternehmen].filter(Boolean).join(" – ") || "TanzRaum";
  const ortZeile = [a.plz, a.ort].filter(Boolean).join(" ");
  const oben = A4.h - 48;

  // Farbbalken oben (TanzRaum-Rot)
  s.drawRectangle({ x: 0, y: A4.h - 8, width: A4.b, height: 8, color: ROT });

  // Logo links oben
  if (logo) {
    const f = Math.min(190 / logo.width, 42 / logo.height);
    s.drawImage(logo, { x: RAND, y: oben - logo.height * f, width: logo.width * f, height: logo.height * f });
  } else {
    z.text(s, "TanzRaum", RAND, oben - 26, { groesse: 24, fett: true, farbe: ROT });
  }

  // Aussteller rechts oben
  let y = oben - 4;
  const rechts = RAND + BREITE;
  y = z.text(s, firma, rechts, y, { groesse: 9.5, fett: true, rechts: true });
  for (const zeile of [a.strasse, ortZeile, a.land && a.land !== "Deutschland" ? a.land : null, a.email, a.telefon ? `Tel. ${a.telefon}` : null]) {
    if (zeile) y = z.text(s, zeile, rechts, y, { groesse: 9, farbe: GRAU, rechts: true });
  }

  // Ruecksendezeile + Empfaenger (Anschriftfeld)
  let ey = A4.h - 150;
  z.text(s, [firma, a.strasse, ortZeile].filter(Boolean).join(" · "), RAND, ey, { groesse: 7.5, farbe: GRAU });
  s.drawLine({ start: { x: RAND, y: ey - 4 }, end: { x: RAND + 250, y: ey - 4 }, thickness: 0.5, color: LINIE });
  ey -= 20;
  if (r.anonymisiert_am) {
    ey = z.text(s, "Empfänger nach Ablauf der Aufbewahrungsfrist anonymisiert", RAND, ey, { groesse: 10.5, farbe: GRAU, breite: 250 });
  } else {
    ey = z.text(s, r.empfaenger_name, RAND, ey, { groesse: 11, fett: true, breite: 250 });
    for (const zeile of adresseZeilen(r.empfaenger_adresse)) ey = z.text(s, zeile, RAND, ey, { groesse: 10.5, breite: 250 });
    if (r.empfaenger_email) ey = z.text(s, r.empfaenger_email, RAND, ey, { groesse: 9.5, farbe: GRAU, breite: 250 });
  }

  // Rechnungsangaben rechts neben dem Anschriftfeld
  const infoX = RAND + 262;
  const werteX = rechts;
  let iy = A4.h - 170;
  const info: [string, string][] = [
    ["Rechnungsnummer", r.nummer],
    ["Rechnungsdatum", datumDe(r.rechnungsdatum)],
    ["Leistungszeitraum", r.leistung_von ? `${datumDe(r.leistung_von)} – ${datumDe(r.leistung_bis)}` : datumDe(r.rechnungsdatum)],
  ];
  if (a.steuernummer) info.push(["Steuernummer", a.steuernummer]);
  if (a.ust_id) info.push(["USt-IdNr.", a.ust_id]);
  for (const [k, v] of info) {
    z.text(s, k, infoX, iy, { groesse: 9, farbe: GRAU });
    z.text(s, v, werteX, iy, { groesse: 9.5, fett: k === "Rechnungsnummer", rechts: true });
    iy -= 15;
  }

  // Titel und Einleitung
  y = Math.min(ey, iy) - 34;
  y = z.text(s, `Rechnung ${r.nummer}`, RAND, y, { groesse: 18, fett: true }) - 6;
  y = z.text(s, "Vielen Dank für deinen Einkauf bei TanzRaum. Wir stellen dir folgende Leistung in Rechnung:", RAND, y, { groesse: 10.5, breite: BREITE }) - 10;

  // Postentabelle
  const sp = { pos: RAND, text: RAND + 34, menge: RAND + 296, einzel: RAND + 405, gesamt: rechts };
  s.drawRectangle({ x: RAND, y: y - 6, width: BREITE, height: 22, color: rgb(0.961, 0.965, 0.976) });
  z.text(s, "Pos.", sp.pos + 6, y, { groesse: 9, fett: true });
  z.text(s, "Beschreibung", sp.text, y, { groesse: 9, fett: true });
  z.text(s, "Menge", sp.menge, y, { groesse: 9, fett: true });
  z.text(s, "Einzelpreis", sp.einzel, y, { groesse: 9, fett: true, rechts: true });
  z.text(s, "Gesamt", sp.gesamt - 6, y, { groesse: 9, fett: true, rechts: true });
  y -= 28;
  const betrag = Number(r.betrag ?? 0);
  z.text(s, "1", sp.pos + 6, y, { groesse: 10 });
  let ty = z.text(s, r.leistung, sp.text, y, { groesse: 10, fett: true, breite: 250 });
  const laufzeit = r.zeitraum === "jahr" ? "Laufzeit 1 Jahr" : r.zeitraum === "monat" ? "Laufzeit 1 Monat" : "";
  if (laufzeit) ty = z.text(s, laufzeit, sp.text, ty, { groesse: 9, farbe: GRAU });
  if (r.leistung_von) ty = z.text(s, `Zeitraum ${datumDe(r.leistung_von)} – ${datumDe(r.leistung_bis)}`, sp.text, ty, { groesse: 9, farbe: GRAU });
  z.text(s, "1", sp.menge + 10, y, { groesse: 10 });
  z.text(s, euro(betrag), sp.einzel, y, { groesse: 10, rechts: true });
  z.text(s, euro(betrag), sp.gesamt - 6, y, { groesse: 10, rechts: true });
  y = ty - 6;
  s.drawLine({ start: { x: RAND, y }, end: { x: rechts, y }, thickness: 0.7, color: LINIE });
  y -= 20;

  // Summen
  const sx = RAND + 290;
  if (a.kleinunternehmer === false) {
    const netto = Math.round((betrag / 1.19) * 100) / 100;
    const ust = Math.round((betrag - netto) * 100) / 100;
    z.text(s, "Nettobetrag", sx, y, { groesse: 10 });
    z.text(s, euro(netto), rechts - 6, y, { groesse: 10, rechts: true });
    y -= 16;
    z.text(s, "Umsatzsteuer 19 %", sx, y, { groesse: 10 });
    z.text(s, euro(ust), rechts - 6, y, { groesse: 10, rechts: true });
    y -= 18;
  }
  s.drawRectangle({ x: sx - 8, y: y - 8, width: rechts - sx + 8, height: 26, color: rgb(0.992, 0.949, 0.953) });
  z.text(s, "Gesamtbetrag", sx, y, { groesse: 11.5, fett: true });
  z.text(s, euro(betrag), rechts - 6, y, { groesse: 11.5, fett: true, rechts: true });
  y -= 40;

  // Hinweise
  if (a.kleinunternehmer !== false) {
    y = z.text(s, a.kleinunternehmer_hinweis || "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).", RAND, y, { groesse: 10, breite: BREITE }) - 4;
  }
  y = z.text(s, `Zahlungsart: ${zahlungsartText(r.zahlungsweg)}. Der Rechnungsbetrag ist bereits beglichen.`, RAND, y, { groesse: 10, breite: BREITE }) - 4;
  y = z.text(s, "Die Lizenz verlängert sich automatisch um die gewählte Laufzeit und kann jederzeit unter „Mein Tarif“ zum Ende des bezahlten Zeitraums gekündigt werden.", RAND, y, { groesse: 9.5, farbe: GRAU, breite: BREITE }) - 14;
  z.text(s, "Diese Rechnung wurde automatisch erstellt und ist ohne Unterschrift gültig.", RAND, y, { groesse: 9, farbe: GRAU, breite: BREITE });

  // Fusszeile
  const fy = 58;
  s.drawLine({ start: { x: RAND, y: fy + 16 }, end: { x: rechts, y: fy + 16 }, thickness: 0.5, color: LINIE });
  const spalte = BREITE / 3;
  z.text(s, `${firma}\n${[a.strasse, ortZeile].filter(Boolean).join(", ")}`, RAND, fy, { groesse: 7.5, farbe: GRAU, breite: spalte - 8, abstand: 1.35 });
  z.text(s, `${a.email ?? ""}\ntanzraum.app`, RAND + spalte, fy, { groesse: 7.5, farbe: GRAU, breite: spalte - 8, abstand: 1.35 });
  z.text(s, [a.steuernummer ? `Steuernummer ${a.steuernummer}` : "", a.ust_id ? `USt-IdNr. ${a.ust_id}` : ""].filter(Boolean).join("\n") || " ", RAND + 2 * spalte, fy, {
    groesse: 7.5,
    farbe: GRAU,
    breite: spalte - 8,
    abstand: 1.35,
  });
}

// Eine oder mehrere Rechnungen als PDF (je Rechnung eine Seite)
export async function rechnungPdf(rechnungen: RechnungDaten[], logoBytes?: Uint8Array | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(rechnungen.length === 1 ? `Rechnung ${rechnungen[0].nummer}` : `TanzRaum-Rechnungen (${rechnungen.length})`);
  doc.setAuthor("TanzRaum");
  doc.setCreator("TanzRaum");
  const z = new Zeichner();
  await z.init(doc);
  let logo: PDFImage | null = null;
  if (logoBytes && logoBytes.length > 8) {
    try {
      if (logoBytes[0] === 0x89 && logoBytes[1] === 0x50) logo = await doc.embedPng(logoBytes);
      else if (logoBytes[0] === 0xff && logoBytes[1] === 0xd8) logo = await doc.embedJpg(logoBytes);
    } catch {
      logo = null;
    }
  }
  for (const r of rechnungen) seiteZeichnen(doc, z, r, logo);
  return await doc.save();
}

// Logo von der eigenen Domain (wie in den E-Mails); ohne Logo wird "TanzRaum" als Schriftzug gesetzt
export async function rechnungLogo(appUrl: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${appUrl}/email/tanzraum-logo-v2.png`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
