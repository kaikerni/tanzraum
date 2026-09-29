import type { SupabaseClient } from "@supabase/supabase-js";
import {
  datenAus,
  einstellungenAus,
  inhaltAus,
  WAEHLBARE_VERFAHREN,
  type AntragDaten,
  type AntragEinstellungen,
  type AntragInhalt,
  type Unterschriften,
  type Verfahren,
} from "./vorlage";

export type AntragStatus = "offen" | "eingereicht" | "angenommen" | "abgelehnt";

export const STATUS_LABEL: Record<AntragStatus, string> = {
  offen: "Noch nicht ausgefüllt",
  eingereicht: "Eingegangen",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
};
export const STATUS_BADGE: Record<AntragStatus, string> = {
  offen: "offen",
  eingereicht: "vielleicht",
  angenommen: "zugesagt",
  abgelehnt: "abgesagt",
};

export type AntragsVerein = { vereinId: string; vereinName: string };

export type VereinsDaten = {
  id: string;
  name: string;
  logo_url: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  email: string | null;
  telefon: string | null;
  webseite: string | null;
  sepa_glaeubiger_id: string | null;
};

// Vereine, deren Antraege man verwalten darf (Vereinsadmin oder Bereich "beitritt", mit Vereinslizenz)
export async function getAntragsVereine(supabase: SupabaseClient): Promise<AntragsVerein[]> {
  const { data: bereiche } = await supabase.rpc("meine_bereiche");
  const ids = [
    ...new Set(
      // deno-lint-ignore no-explicit-any
      ((bereiche ?? []) as any[]).filter((b) => b.bereich === "beitritt" || b.bereich === "rolle_admin").map((b) => b.verein_id as string),
    ),
  ];
  if (ids.length === 0) return [];
  const { data } = await supabase.from("vereine").select("id, name").in("id", ids).order("name");
  return (data ?? []).map((v) => ({ vereinId: v.id, vereinName: v.name }));
}

export type AntragListenEintrag = {
  id: string;
  status: AntragStatus;
  name: string;
  erstelltAm: string;
  eingereichtAm: string | null;
  entschiedenAm: string | null;
  verfahren: Verfahren | null;
  papierVorliegend: boolean;
  mitgliedsnummer: string | null;
  minderjaehrig: boolean | null;
};

export async function getAntraegeListe(supabase: SupabaseClient, vereinId: string): Promise<AntragListenEintrag[]> {
  const { data } = await supabase.rpc("antraege_liste", { p_verein_id: vereinId });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((a) => ({
    id: a.id,
    status: a.status,
    name: a.name,
    erstelltAm: a.erstellt_am,
    eingereichtAm: a.eingereicht_am,
    entschiedenAm: a.entschieden_am,
    verfahren: a.unterschrift_verfahren,
    papierVorliegend: a.papier_vorliegend,
    mitgliedsnummer: a.mitgliedsnummer,
    minderjaehrig: a.minderjaehrig,
  }));
}

export type FreigabeAnfrage = { id: string; richtung: "eingehend" | "ausgehend"; person: string; andererVerein: string; erstelltAm: string };

export async function getFreigabeAnfragen(supabase: SupabaseClient, vereinId: string): Promise<FreigabeAnfrage[]> {
  const { data } = await supabase.rpc("freigabe_anfragen", { p_verein_id: vereinId });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((w) => ({
    id: w.id,
    richtung: w.richtung,
    person: w.person ?? "Person",
    andererVerein: w.anderer_verein ?? "anderer Verein",
    erstelltAm: w.erstellt_am,
  }));
}

export type VorlageDaten = {
  inhalt: AntragInhalt;
  einstellungen: AntragEinstellungen;
  gespeichert: boolean;
  verein: VereinsDaten;
  gruppen: string[];
};

// Vorlage fuer den Editor; ohne gespeicherte Vorlage mit Vereinsdaten vorbelegt
export async function getVorlage(supabase: SupabaseClient, vereinId: string): Promise<VorlageDaten | null> {
  const [{ data: verein }, { data: vorlage }, { data: gruppen }] = await Promise.all([
    supabase
      .from("vereine")
      .select("id, name, logo_url, strasse, hausnummer, plz, ort, email, telefon, webseite, sepa_glaeubiger_id")
      .eq("id", vereinId)
      .maybeSingle(),
    supabase.from("antrag_vorlagen").select("inhalt, einstellungen").eq("verein_id", vereinId).maybeSingle(),
    supabase.from("gruppen").select("name").eq("verein_id", vereinId).order("name"),
  ]);
  if (!verein) return null;
  const inhalt = inhaltAus(vorlage?.inhalt);
  const einstellungen = einstellungenAus(vorlage?.einstellungen);
  if (!vorlage) {
    const strasse = [verein.strasse, verein.hausnummer].filter(Boolean).join(" ");
    const ort = [verein.plz, verein.ort].filter(Boolean).join(" ");
    inhalt.anschrift = [strasse, ort].filter(Boolean).join(", ");
    inhalt.kontakt = [verein.telefon ? `Tel. ${verein.telefon}` : "", verein.email ?? "", verein.webseite ?? ""].filter(Boolean).join("\n");
    inhalt.glaeubiger_id = verein.sepa_glaeubiger_id ?? "";
    inhalt.abteilungen = (gruppen ?? []).map((g) => g.name).filter(Boolean).slice(0, 30);
    einstellungen.empfaenger_email = verein.email ?? "";
  }
  return {
    inhalt,
    einstellungen,
    gespeichert: !!vorlage,
    verein: verein as VereinsDaten,
    gruppen: (gruppen ?? []).map((g) => g.name).filter(Boolean),
  };
}

export type AntragFormularDaten = {
  id: string;
  vereinId: string;
  userId: string | null;
  status: AntragStatus;
  daten: AntragDaten;
  verfahren: Verfahren | null;
  unterschriften: Unterschriften;
  inhalt: AntragInhalt;
  verein: VereinsDaten;
  erlaubteVerfahren: Verfahren[];
  // Bereits Mitglied: Bestaetigung statt neuem Antrag (Einstellung des Vereins)
  bestehendErlaubt: boolean;
  externText: string;
  externLink: string;
  personName: string | null;
  darfVerwalten: boolean;
  fuerMich: boolean;
  eingereichtAm: string | null;
  entschiedenAm: string | null;
  ablehnungsgrund: string | null;
  papierDatei: string | null;
  papierVorliegend: boolean;
  aufnahmePdf: string | null;
  mitgliedsnummer: string | null;
  familiennummer: string | null;
  notizIntern: string | null;
  erstelltAm: string;
};

export async function getAntragFormular(supabase: SupabaseClient, antragId: string): Promise<AntragFormularDaten | null> {
  const { data, error } = await supabase.rpc("antrag_formular", { p_antrag_id: antragId });
  if (error || !data) return null;
  // deno-lint-ignore no-explicit-any
  const f = data as any;
  const a = f.antrag;
  const eingereicht = a.status !== "offen";
  // Eingereichte Antraege zeigen den Formularstand der Einreichung (was bestaetigt wurde)
  const inhalt = inhaltAus(eingereicht && a.vorlage?.inhalt ? a.vorlage.inhalt : f.inhalt);
  let daten = datenAus(a.daten);
  if (a.status === "offen" && f.person) {
    // Vorbelegung aus dem Konto, solange noch nichts gespeichert ist
    daten = {
      ...daten,
      vorname: daten.vorname || f.person.vorname || "",
      nachname: daten.nachname || f.person.nachname || "",
      geburtsdatum: daten.geburtsdatum || f.person.geburtsdatum || "",
      email: daten.email || f.person.email || "",
      handy: daten.handy || f.person.telefon || "",
    };
  }
  const verfahren = ((f.verfahren ?? []) as string[]).filter((v): v is Verfahren => WAEHLBARE_VERFAHREN.includes(v as Verfahren));
  const optionen = f.optionen ?? {};
  return {
    id: a.id,
    vereinId: a.verein_id,
    userId: a.user_id,
    status: a.status,
    daten,
    verfahren: a.unterschrift_verfahren,
    unterschriften: a.unterschriften ?? {},
    inhalt,
    verein: (eingereicht && a.vorlage?.verein ? { ...f.verein, ...a.vorlage.verein } : f.verein) as VereinsDaten,
    erlaubteVerfahren: verfahren.length ? verfahren : ["bildschirm", "papier"],
    bestehendErlaubt: optionen.bestehende_bestaetigen !== false,
    externText: typeof optionen.extern_text === "string" ? optionen.extern_text : "",
    externLink: typeof optionen.extern_link === "string" && optionen.extern_link.startsWith("https://") ? optionen.extern_link : "",
    personName: f.person_name ?? null,
    darfVerwalten: !!f.darf_verwalten,
    fuerMich: !!f.fuer_mich,
    eingereichtAm: a.eingereicht_am,
    entschiedenAm: a.entschieden_am,
    ablehnungsgrund: a.ablehnungsgrund,
    papierDatei: a.papier_datei,
    papierVorliegend: !!a.papier_vorliegend,
    aufnahmePdf: a.aufnahme_pdf,
    mitgliedsnummer: a.mitgliedsnummer,
    familiennummer: a.familiennummer,
    notizIntern: a.notiz_intern ?? null,
    erstelltAm: a.erstellt_am,
  };
}

export type MeinAntrag = {
  id: string;
  vereinId: string;
  vereinName: string;
  status: AntragStatus;
  fuerMichSelbst: boolean;
  name: string | null;
  erstelltAm: string;
  eingereichtAm: string | null;
  entschiedenAm: string | null;
  aufnahmePdf: boolean;
};

export async function getMeineAntraege(supabase: SupabaseClient): Promise<MeinAntrag[]> {
  const { data } = await supabase.rpc("meine_mitgliedsantraege");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((a) => ({
    id: a.id,
    vereinId: a.verein_id,
    vereinName: a.verein_name,
    status: a.status,
    fuerMichSelbst: a.fuer_mich_selbst,
    name: a.name,
    erstelltAm: a.erstellt_am,
    eingereichtAm: a.eingereicht_am,
    entschiedenAm: a.entschieden_am,
    aufnahmePdf: a.aufnahme_pdf,
  }));
}

export function datumKurz(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}
