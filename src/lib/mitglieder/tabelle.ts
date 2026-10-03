// Liest eine Mitgliederliste (CSV oder Excel .xlsx) vollstaendig im Browser.
// Die Datei wird dabei nicht hochgeladen – an den Server gehen spaeter nur die ausgewaehlten Felder.

export type Tabelle = { kopf: string[]; zeilen: string[][] };

export class TabellenFehler extends Error {}

const MAX_ZEILEN = 3000;
const MAX_BYTES = 10 * 1024 * 1024;

export async function leseTabelle(datei: File): Promise<Tabelle> {
  if (datei.size > MAX_BYTES) throw new TabellenFehler("Die Datei ist zu groß (höchstens 10 MB).");
  const name = datei.name.toLowerCase();
  const daten = new Uint8Array(await datei.arrayBuffer());
  let roh: string[][];
  if (name.endsWith(".xlsx") || istZip(daten)) {
    roh = await leseXlsx(daten);
  } else if (name.endsWith(".xls")) {
    throw new TabellenFehler("Das alte Excel-Format (.xls) wird nicht unterstützt. Bitte speichere die Datei als .xlsx oder .csv.");
  } else {
    roh = leseCsv(dekodiere(daten));
  }
  return aufbereiten(roh);
}

function istZip(d: Uint8Array) {
  return d.length > 4 && d[0] === 0x50 && d[1] === 0x4b && d[2] === 0x03 && d[3] === 0x04;
}

// Leere Zeilen/Spalten entfernen, Kopfzeile = erste Zeile mit Inhalt
function aufbereiten(roh: string[][]): Tabelle {
  const zeilen = roh.map((z) => z.map((w) => (w ?? "").replace(/\s+/g, " ").trim())).filter((z) => z.some((w) => w !== ""));
  if (zeilen.length < 2) throw new TabellenFehler("In der Datei wurden keine Mitglieder gefunden. Die erste Zeile muss die Spaltennamen enthalten.");
  const breite = Math.max(...zeilen.map((z) => z.length));
  const kopfRoh = zeilen[0];
  const genutzt = Array.from({ length: breite }, (_, i) => zeilen.some((z) => (z[i] ?? "") !== ""));
  const spalten = genutzt.map((g, i) => (g ? i : -1)).filter((i) => i >= 0);
  const kopf = spalten.map((i, n) => kopfRoh[i] || `Spalte ${n + 1}`);
  const daten = zeilen.slice(1).map((z) => spalten.map((i) => z[i] ?? ""));
  if (daten.length > MAX_ZEILEN) throw new TabellenFehler(`Die Datei enthält mehr als ${MAX_ZEILEN} Zeilen. Bitte teile sie auf.`);
  return { kopf, zeilen: daten };
}

// ── CSV ──────────────────────────────────────────────────────────────────────────────────────────────
function dekodiere(d: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(d);
  } catch {
    // Viele Vereinsprogramme exportieren noch in Windows-1252 (Umlaute)
    text = new TextDecoder("windows-1252").decode(d);
  }
  return text.replace(/^﻿/, "");
}

function trennzeichen(text: string): string {
  const ersteZeile = text.split(/\r?\n/).find((z) => z.trim() !== "") ?? "";
  let besser = ";";
  let max = -1;
  for (const t of [";", ",", "\t", "|"]) {
    let n = 0;
    let inAnf = false;
    for (const c of ersteZeile) {
      if (c === '"') inAnf = !inAnf;
      else if (c === t && !inAnf) n++;
    }
    if (n > max) {
      max = n;
      besser = t;
    }
  }
  return besser;
}

export function leseCsv(text: string): string[][] {
  const t = trennzeichen(text);
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = "";
  let inAnf = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inAnf) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"';
          i++;
        } else inAnf = false;
      } else feld += c;
    } else if (c === '"' && feld === "") inAnf = true;
    else if (c === t) {
      zeile.push(feld);
      feld = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      zeile.push(feld);
      zeilen.push(zeile);
      zeile = [];
      feld = "";
    } else feld += c;
  }
  if (feld !== "" || zeile.length > 0) {
    zeile.push(feld);
    zeilen.push(zeile);
  }
  return zeilen;
}

// ── XLSX (ZIP + XML, ohne Fremdbibliothek) ───────────────────────────────────────────────────────────
type ZipEintrag = { name: string; methode: number; groesse: number; offset: number };

function zipVerzeichnis(d: Uint8Array): Map<string, ZipEintrag> {
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let ende = -1;
  for (let i = d.length - 22; i >= Math.max(0, d.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      ende = i;
      break;
    }
  }
  if (ende < 0) throw new TabellenFehler("Die Excel-Datei konnte nicht gelesen werden.");
  const anzahl = v.getUint16(ende + 10, true);
  let pos = v.getUint32(ende + 16, true);
  const eintraege = new Map<string, ZipEintrag>();
  const dec = new TextDecoder();
  for (let n = 0; n < anzahl; n++) {
    if (v.getUint32(pos, true) !== 0x02014b50) break;
    const methode = v.getUint16(pos + 10, true);
    const groesse = v.getUint32(pos + 20, true);
    const nameLen = v.getUint16(pos + 28, true);
    const extraLen = v.getUint16(pos + 30, true);
    const kommLen = v.getUint16(pos + 32, true);
    const offset = v.getUint32(pos + 42, true);
    const name = dec.decode(d.subarray(pos + 46, pos + 46 + nameLen));
    eintraege.set(name, { name, methode, groesse, offset });
    pos += 46 + nameLen + extraLen + kommLen;
  }
  return eintraege;
}

async function zipLesen(d: Uint8Array, e: ZipEintrag): Promise<string> {
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const roh = d.subarray(start, start + e.groesse);
  if (e.methode === 0) return new TextDecoder().decode(roh);
  if (e.methode !== 8) throw new TabellenFehler("Die Excel-Datei verwendet ein unbekanntes Format.");
  const strom = new Blob([new Uint8Array(roh)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(strom).text();
}

function xml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function kinder(el: Element | Document, name: string): Element[] {
  return Array.from(el.getElementsByTagNameNS("*", name));
}

function spaltenIndex(ref: string): number {
  const buchstaben = ref.replace(/[0-9]/g, "").toUpperCase();
  let n = 0;
  for (const c of buchstaben) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

const DATUMS_FORMATE = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

export function excelDatum(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null;
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function leseXlsx(d: Uint8Array): Promise<string[][]> {
  const zip = zipVerzeichnis(d);
  const holen = async (name: string) => {
    const e = zip.get(name);
    return e ? await zipLesen(d, e) : null;
  };

  // Erstes Tabellenblatt ermitteln
  let blattPfad = "xl/worksheets/sheet1.xml";
  const wb = await holen("xl/workbook.xml");
  const rels = await holen("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const erstes = kinder(xml(wb), "sheet")[0];
    const rid = erstes?.getAttribute("r:id") ?? erstes?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const ziel = kinder(xml(rels), "Relationship").find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
    if (ziel) blattPfad = ziel.startsWith("/") ? ziel.slice(1) : `xl/${ziel.replace(/^\.\//, "")}`;
  }
  const blatt = await holen(blattPfad);
  if (!blatt) throw new TabellenFehler("In der Excel-Datei wurde kein Tabellenblatt gefunden.");

  const geteilt: string[] = [];
  const ss = await holen("xl/sharedStrings.xml");
  if (ss) {
    for (const si of kinder(xml(ss), "si")) {
      geteilt.push(kinder(si, "t").filter((t) => t.parentElement?.localName !== "rPh").map((t) => t.textContent ?? "").join(""));
    }
  }

  // Zellformate, die ein Datum darstellen
  const datumsStile = new Set<number>();
  const stile = await holen("xl/styles.xml");
  if (stile) {
    const doc = xml(stile);
    const eigene = new Map<number, string>();
    for (const f of kinder(doc, "numFmt")) eigene.set(Number(f.getAttribute("numFmtId")), (f.getAttribute("formatCode") ?? "").toLowerCase());
    const xfs = kinder(doc, "cellXfs")[0];
    if (xfs) {
      kinder(xfs, "xf").forEach((xf, i) => {
        const id = Number(xf.getAttribute("numFmtId") ?? 0);
        const code = eigene.get(id)?.replace(/"[^"]*"|\[[^\]]*\]/g, "") ?? "";
        if (DATUMS_FORMATE.has(id) || (/[dy]/.test(code) && !/^[hms:.0#,]+$/.test(code))) datumsStile.add(i);
      });
    }
  }

  const zeilen: string[][] = [];
  for (const row of kinder(xml(blatt), "row")) {
    const zeile: string[] = [];
    let naechste = 0;
    for (const c of kinder(row, "c")) {
      const ref = c.getAttribute("r");
      const idx = ref ? spaltenIndex(ref) : naechste;
      naechste = idx + 1;
      const typ = c.getAttribute("t");
      const v = kinder(c, "v")[0]?.textContent ?? "";
      let wert = "";
      if (typ === "s") wert = geteilt[Number(v)] ?? "";
      else if (typ === "inlineStr") wert = kinder(c, "t").map((t) => t.textContent ?? "").join("");
      else if (typ === "b") wert = v === "1" ? "ja" : "nein";
      else if (typ === "str" || typ === "e") wert = v;
      else if (v !== "") {
        const stil = Number(c.getAttribute("s") ?? -1);
        wert = datumsStile.has(stil) ? (excelDatum(Number(v)) ?? v) : String(Number(v));
      }
      zeile[idx] = wert;
    }
    zeilen.push(Array.from(zeile, (w) => w ?? ""));
  }
  return zeilen;
}
