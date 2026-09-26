// Ehrungen & Orden – Bezeichnungen, Typen und nachvollziehbare Darstellung der Berechnung.
// Automatische Vorschlaege sind nur "moegliche Ehrungen aufgrund der in TanzRaum hinterlegten Kriterien" – kein Anspruch.

export const STATUS = {
  moeglich: { label: "Möglich", zeichen: "🟡", klasse: "bg-brand-amber-wash text-[#8a5a00]" },
  geprueft: { label: "Geprüft", zeichen: "🔍", klasse: "bg-brand-purple-wash text-brand-purple" },
  vorgemerkt: { label: "Vorgemerkt", zeichen: "🔵", klasse: "bg-brand-blue-wash text-brand-blue" },
  bestellt: { label: "Bestellt", zeichen: "🟠", klasse: "bg-brand-gold-wash text-[#8a5a00]" },
  erhalten: { label: "Erhalten", zeichen: "📦", klasse: "bg-brand-gold-wash text-[#8a5a00]" },
  eingeplant: { label: "Eingeplant", zeichen: "📅", klasse: "bg-brand-blue-wash text-brand-blue" },
  verliehen: { label: "Verliehen", zeichen: "🟢", klasse: "bg-brand-green-wash text-brand-green" },
  nicht_vorgesehen: { label: "Nicht vorgesehen", zeichen: "⚪", klasse: "bg-brand-bg text-brand-ink-soft" },
  abgelehnt: { label: "Abgelehnt", zeichen: "⛔", klasse: "bg-brand-red-wash text-brand-red" },
} as const;
export type Status = keyof typeof STATUS;
export const STATUS_REIHENFOLGE: Status[] = [
  "moeglich", "geprueft", "vorgemerkt", "bestellt", "erhalten", "eingeplant", "verliehen", "nicht_vorgesehen", "abgelehnt",
];
// Offene Vorgaenge (noch nicht abgeschlossen)
export const OFFEN: Status[] = ["moeglich", "geprueft", "vorgemerkt", "bestellt", "erhalten", "eingeplant"];

export const HERKUNFT = {
  automatisch: { label: "Automatisch ermittelt", zeichen: "🟡" },
  manuell_geaendert: { label: "Manuell geändert", zeichen: "✏️" },
  manuell_angelegt: { label: "Manuell angelegt", zeichen: "📝" },
} as const;
export type Herkunft = keyof typeof HERKUNFT;

export const PRUEFSTATUS = {
  nicht_geprueft: { label: "Nicht überprüft", zeichen: "🟡", text: "Aus Kompendium übernommen – Prüfung erforderlich" },
  geprueft: { label: "Überprüft", zeichen: "🔵", text: "Vom zuständigen Vereins-/TanzRaum-Admin geprüft" },
  bestaetigt: { label: "Bestätigt", zeichen: "🟢", text: "Aktuelle offizielle Quelle geprüft" },
} as const;
export type Pruefstatus = keyof typeof PRUEFSTATUS;

export const TYP = {
  verband: { label: "Verbandsauszeichnung", kurz: "Verband", zeichen: "🏛️" },
  verein: { label: "Vereinsinterne Auszeichnung", kurz: "Vereinsintern", zeichen: "🏠" },
} as const;
export type Typ = keyof typeof TYP;

export const BERECHNUNG = {
  mitgliedschaft: "Jahre Vereinsmitgliedschaft",
  aktiv: "Jahre aktive Tätigkeit",
  funktion: "Jahre in einer Funktion",
  ehrenamt: "Jahre ehrenamtliche Tätigkeit",
  punkte: "Punktesystem",
  manuell: "Manuelle Entscheidung (keine automatische Berechnung)",
} as const;
export type Berechnung = keyof typeof BERECHNUNG;

export const ZEITRAUM_ART = {
  mitgliedschaft: "Mitgliedschaft",
  aktiv: "Aktive Tätigkeit",
  funktion: "Funktion",
  ehrenamt: "Ehrenamt",
} as const;
export type ZeitraumArt = keyof typeof ZEITRAUM_ART;

export const HINWEIS_VORSCHLAG = "Mögliche Ehrung aufgrund der aktuell in TanzRaum hinterlegten Kriterien – kein Anspruch auf Verleihung.";
export const HINWEIS_BESTELLUNG =
  "Bitte prüfen Sie vor der Bestellung die aktuell gültigen Voraussetzungen und Angaben des zuständigen Verbandes. Die in TanzRaum hinterlegten Ehrungsdaten basieren teilweise auf einer Arbeitsgrundlage und wurden möglicherweise nicht vollständig auf Aktualität und Fehlerfreiheit geprüft.";

export type Regel = {
  id: string;
  ehrungsartId: string;
  berechnung: Berechnung;
  jahre: number | null;
  funktion: string | null;
  punkteMin: number | null;
  punkteGewichte: Record<string, number> | null;
  ununterbrochen: boolean;
  bemerkung: string | null;
};

// Abweichende Werte einer Verbandsregel fuer einen Verein (null = Voreinstellung aus dem Katalog)
export type Anpassung = {
  id: string;
  regelId: string;
  aktiv: boolean;
  jahre: number | null;
  funktion: string | null;
  punkteMin: number | null;
  punkteGewichte: Record<string, number> | null;
  ununterbrochen: boolean | null;
  bemerkung: string | null;
  updatedAt: string;
};

export function wirksameRegel(r: Regel, a?: Anpassung | null): Regel {
  if (!a) return r;
  return {
    ...r,
    jahre: a.jahre ?? r.jahre,
    funktion: a.funktion ?? r.funktion,
    punkteMin: a.punkteMin ?? r.punkteMin,
    punkteGewichte: a.punkteGewichte ?? r.punkteGewichte,
    ununterbrochen: a.ununterbrochen ?? r.ununterbrochen,
    bemerkung: a.bemerkung ?? r.bemerkung,
  };
}

export function regelKurz(r: Regel): string {
  return r.berechnung === "manuell" ? "Manuelle Vergabe" : regelText({ ...r, punkte_min: r.punkteMin, punkte_gewichte: r.punkteGewichte });
}

export type Auszeichnung = {
  id: string;
  typ: Typ;
  organisationId: string | null;
  organisation: string | null;
  vereinId: string | null;
  serie: string | null;
  name: string;
  kurz: string | null;
  beschreibung: string | null;
  kategorie: string | null;
  stufe: string | null;
  stufeNr: number | null;
  voraussetzungen: string | null;
  regelVerknuepfung: "eine" | "alle";
  automatischeVorschlaege: boolean;
  antragErforderlich: boolean | null;
  bestellungErforderlich: boolean;
  symbol: string | null;
  bemerkung: string | null;
  aktiv: boolean;
  pruefstatus: Pruefstatus;
  gepruefAm: string | null;
  quelle: string | null;
  quelleUrl: string | null;
  pruefBemerkung: string | null;
  naechstePruefung: string | null;
  regeln: Regel[];
};

export type GrundlageRegel = {
  berechnung: Berechnung;
  jahre: number | null;
  funktion: string | null;
  punkte_min: number | null;
  punkte_gewichte: Record<string, number> | null;
  ununterbrochen: boolean;
  beginn: string | null;
  korrektur_von: string | null;
  faellig_am: string | null;
  bemerkung?: string | null;
  vereinsanpassung?: boolean;
};
export type Grundlage = { verknuepfung: "eine" | "alle"; regeln: GrundlageRegel[]; faellig_am: string | null; berechnet_am?: string };

export type Vorgang = {
  id: string;
  vereinId: string;
  vereinsMitgliedId: string | null;
  personName: string;
  ehrungsartId: string;
  auszeichnung: string;
  typ: Typ;
  organisation: string | null;
  serie: string | null;
  stufe: string | null;
  kategorie: string | null;
  bestellungErforderlich: boolean;
  pruefstatus: Pruefstatus;
  herkunft: Herkunft;
  autoEhrungsartId: string | null;
  autoAuszeichnung: string | null;
  autoFaelligAm: string | null;
  autoGrundlage: Grundlage | null;
  faelligAm: string | null;
  faelligJahr: number | null;
  grundlage: Grundlage | null;
  grundlageText: string | null;
  korrektur: { beginn?: string } | null;
  status: Status;
  begruendung: string | null;
  interneNotiz: string | null;
  wunschDatum: string | null;
  anlass: string | null;
  veranstaltung: string | null;
  bestellungId: string | null;
  bestelltAm: string | null;
  erhaltenAm: string | null;
  eingeplantAm: string | null;
  verliehenAm: string | null;
  verliehenDurch: string | null;
  verleihungBemerkung: string | null;
  snapshot: Record<string, unknown> | null;
  updatedAt: string;
};

export function datum(wert: string | null | undefined): string {
  if (!wert) return "–";
  const [j, m, t] = wert.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}

function zahl(n: number): string {
  return String(n).replace(".", ",").replace(/,0+$/, "");
}

function kriterium(k: string): string {
  if (k.startsWith("funktion:")) return `Funktion ${k.slice(9)}`;
  return ZEITRAUM_ART[k as ZeitraumArt] ?? k;
}

// Menschlich lesbare Berechnungsgrundlage – keine Blackbox.
export function regelText(r: Pick<GrundlageRegel, "berechnung" | "jahre" | "funktion" | "punkte_min" | "punkte_gewichte" | "ununterbrochen">): string {
  switch (r.berechnung) {
    case "mitgliedschaft":
      return `${zahl(Number(r.jahre))} Jahre Vereinsmitgliedschaft${r.ununterbrochen ? " (ununterbrochen)" : ""}`;
    case "aktiv":
      return `${zahl(Number(r.jahre))} Jahre aktive Tätigkeit${r.ununterbrochen ? " (ununterbrochen)" : ""}`;
    case "ehrenamt":
      return `${zahl(Number(r.jahre))} Jahre ehrenamtliche Tätigkeit${r.ununterbrochen ? " (ununterbrochen)" : ""}`;
    case "funktion":
      return `${zahl(Number(r.jahre))} Jahre als ${r.funktion}${r.ununterbrochen ? " (ununterbrochen)" : ""}`;
    case "punkte": {
      const g = Object.entries(r.punkte_gewichte ?? {})
        .map(([k, v]) => `${kriterium(k)} ${zahl(Number(v))} Pkt./Jahr`)
        .join(", ");
      return `${zahl(Number(r.punkte_min))} Punkte${g ? ` (${g})` : ""}`;
    }
    default:
      return "Manuelle Entscheidung";
  }
}

export function grundlageZeilen(g: Grundlage | null): string[] {
  if (!g || !g.regeln?.length) return ["Keine automatische Berechnung hinterlegt."];
  const zeilen = g.regeln.map((r) => {
    if (r.berechnung === "manuell") return "Manuelle Entscheidung durch den Vereinsadmin";
    const teile = [`Erforderlich: ${regelText(r)}`];
    if (r.beginn) teile.push(`${r.berechnung === "punkte" ? "Erster Zeitraum ab" : "Beginn"} ${datum(r.beginn)}`);
    if (r.vereinsanpassung) teile.push("für diesen Verein angepasst");
    if (r.korrektur_von) teile.push(`Korrektur für diesen Vorgang: Beginn ${datum(r.korrektur_von)}`);
    teile.push(r.faellig_am ? `voraussichtlich ${datum(r.faellig_am)}` : "mit den hinterlegten Zeiten nicht erreichbar");
    return teile.join(" · ");
  });
  if (g.regeln.filter((r) => r.berechnung !== "manuell").length > 1) {
    zeilen.push(g.verknuepfung === "alle" ? "Alle Kriterien müssen erfüllt sein." : "Eines der Kriterien genügt.");
  }
  return zeilen;
}

export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

// Massgeblicher Termin einer Ehrung: Verleihung > geplanter Termin > Wunschtermin > voraussichtliche Faelligkeit
export function stichtagVon(v: Vorgang): string | null {
  if (v.status === "verliehen") return v.verliehenAm;
  return v.eingeplantAm ?? v.wunschDatum ?? v.faelligAm;
}

export function jahresEintraege(vorgaenge: Vorgang[], jahr: number): Vorgang[] {
  return vorgaenge
    .filter((v) => !["nicht_vorgesehen", "abgelehnt"].includes(v.status))
    .filter((v) => stichtagVon(v)?.startsWith(String(jahr)))
    .sort((a, b) => (stichtagVon(a) ?? "").localeCompare(stichtagVon(b) ?? "") || a.personName.localeCompare(b.personName, "de"));
}

export function grundKurz(v: Vorgang): string {
  return v.grundlageText ?? (v.herkunft === "manuell_angelegt" ? (v.begruendung ?? "–") : grundlageZeilen(v.grundlage)[0]);
}
