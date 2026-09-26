"use server";

// Ehrungen & Orden – Server-Aktionen. Alle Zugriffe laufen mit der Sitzung des Nutzers; die Datenbank (RLS,
// Trigger, Admin-Funktionen) erlaubt sie nur Vereinsadmins des jeweiligen Vereins.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { BERECHNUNG, STATUS, ZEITRAUM_ART, type Status } from "@/lib/ehrungen/typen";

const PFAD = "/dashboard/vereinsverwaltung/ehrungen";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

async function sitzung() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function text(fd: FormData, feld: string, max = 2000): string | null {
  const w = String(fd.get(feld) ?? "").trim();
  return w ? w.slice(0, max) : null;
}
function id(fd: FormData, feld: string): string | null {
  const w = String(fd.get(feld) ?? "").trim();
  return UUID.test(w) ? w : null;
}
function datumFeld(fd: FormData, feld: string): string | null | false {
  const w = String(fd.get(feld) ?? "").trim();
  if (!w) return null;
  return DATUM.test(w) ? w : false;
}
function zahlFeld(fd: FormData, feld: string): number | null | false {
  const w = String(fd.get(feld) ?? "").trim().replace(",", ".");
  if (!w) return null;
  const n = Number(w);
  return Number.isFinite(n) ? n : false;
}
// Fehlermeldungen der Datenbank-Pruefungen (P0001) sind fuer Nutzer formuliert; alles andere bleibt neutral.
function fehler(e: { code?: string; message?: string } | null, standard: string): string {
  if (e?.code === "P0001" && e.message) return e.message;
  if (e?.code === "42501") return "Dafür fehlt die Berechtigung (nur Vereinsadmins).";
  if (e?.code === "23505") return "Dieser Eintrag existiert bereits.";
  return standard;
}
function neuLaden() {
  revalidatePath(PFAD, "layout");
  revalidatePath("/dashboard/admin/ehrungen", "layout");
}

// ---------------------------------------------------------------------------------------------
// Vorschlaege
// ---------------------------------------------------------------------------------------------
export async function vorschlaegeAktualisieren(vereinId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(vereinId)) return { error: "Ungültiger Verein." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("ehrungen_aktualisieren", { p_verein_id: vereinId });
  if (error) return { error: fehler(error, "Die Vorschläge konnten nicht berechnet werden.") };
  neuLaden();
  const n = Number(data ?? 0);
  return { error: null, ok: n === 0 ? "Keine neuen möglichen Ehrungen gefunden." : `${n} neue mögliche Ehrung${n === 1 ? "" : "en"} gefunden.` };
}

// ---------------------------------------------------------------------------------------------
// Vorgang bearbeiten / Status / Zuruecksetzen / Korrektur
// ---------------------------------------------------------------------------------------------
export async function vorgangBearbeiten(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vorgangId = id(fd, "id");
  const artId = id(fd, "ehrungsart_id");
  const faellig = datumFeld(fd, "faellig_am");
  const wunsch = datumFeld(fd, "wunsch_datum");
  if (!vorgangId || !artId) return { error: "Bitte eine Auszeichnung auswählen." };
  if (faellig === false || wunsch === false) return { error: "Bitte ein gültiges Datum angeben." };
  const { supabase } = await sitzung();
  const { data: alt } = await supabase
    .from("mitglied_ehrungen")
    .select("ehrungsart_id, faellig_am, grundlage_text, herkunft")
    .eq("id", vorgangId)
    .maybeSingle();
  if (!alt) return { error: "Der Vorgang wurde nicht gefunden." };
  const grundlageText = text(fd, "grundlage_text");
  const fachlichGeaendert =
    alt.ehrungsart_id !== artId || (alt.faellig_am ?? null) !== faellig || (alt.grundlage_text ?? null) !== grundlageText;
  const { error } = await supabase
    .from("mitglied_ehrungen")
    .update({
      ehrungsart_id: artId,
      faellig_am: faellig,
      grundlage_text: grundlageText,
      begruendung: text(fd, "begruendung"),
      interne_notiz: text(fd, "interne_notiz"),
      wunsch_datum: wunsch,
      anlass: text(fd, "anlass", 300),
      veranstaltung: text(fd, "veranstaltung", 300),
      herkunft: fachlichGeaendert && alt.herkunft === "automatisch" ? "manuell_geaendert" : alt.herkunft,
      aenderungs_begruendung: text(fd, "aenderungs_begruendung", 500),
    })
    .eq("id", vorgangId);
  if (error) return { error: fehler(error, "Die Änderungen konnten nicht gespeichert werden.") };
  neuLaden();
  return { error: null, ok: "Gespeichert." };
}

export async function statusSetzen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vorgangId = id(fd, "id");
  const status = String(fd.get("status") ?? "") as Status;
  if (!vorgangId || !(status in STATUS)) return { error: "Bitte einen Status auswählen." };
  const felder: Record<string, unknown> = { status, aenderungs_begruendung: text(fd, "aenderungs_begruendung", 500) };
  const heute = new Date().toISOString().slice(0, 10);
  const d = datumFeld(fd, "datum");
  if (d === false) return { error: "Bitte ein gültiges Datum angeben." };
  const { supabase, user } = await sitzung();
  switch (status) {
    case "bestellt":
      if (fd.get("geprueft") !== "ja") return { error: "Bitte bestätigen Sie, dass Sie die Angaben vor der Bestellung geprüft haben." };
      felder.bestellung_geprueft_am = new Date().toISOString();
      felder.bestellung_geprueft_von = user.id;
      felder.bestellt_am = d ?? heute;
      break;
    case "erhalten":
      felder.erhalten_am = d ?? heute;
      break;
    case "eingeplant":
      if (!d) return { error: "Bitte das geplante Verleihungsdatum angeben." };
      felder.eingeplant_am = d;
      felder.wunsch_datum = d;
      if (text(fd, "veranstaltung", 300)) felder.veranstaltung = text(fd, "veranstaltung", 300);
      break;
    case "verliehen":
      if (!d) return { error: "Bitte das Verleihungsdatum angeben." };
      felder.verliehen_am = d;
      felder.verliehen_durch = text(fd, "verliehen_durch", 300);
      felder.verleihung_bemerkung = text(fd, "verleihung_bemerkung");
      if (text(fd, "veranstaltung", 300)) felder.veranstaltung = text(fd, "veranstaltung", 300);
      if (text(fd, "anlass", 300)) felder.anlass = text(fd, "anlass", 300);
      break;
  }
  const { error } = await supabase.from("mitglied_ehrungen").update(felder).eq("id", vorgangId);
  if (error) return { error: fehler(error, "Der Status konnte nicht geändert werden.") };
  neuLaden();
  return { error: null, ok: `Status: ${STATUS[status].label}` };
}

export async function zuruecksetzen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vorgangId = id(fd, "id");
  if (!vorgangId) return { error: "Ungültiger Vorgang." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("ehrung_zuruecksetzen", { p_id: vorgangId, p_begruendung: text(fd, "aenderungs_begruendung", 500) });
  if (error) return { error: fehler(error, "Der Vorgang konnte nicht zurückgesetzt werden.") };
  neuLaden();
  return { error: null, ok: "Auf die automatische Berechnung zurückgesetzt." };
}

export async function korrekturBerechnen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vorgangId = id(fd, "id");
  const beginn = datumFeld(fd, "beginn");
  if (!vorgangId) return { error: "Ungültiger Vorgang." };
  if (beginn === false) return { error: "Bitte ein gültiges Datum angeben." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("ehrung_neu_berechnen", {
    p_id: vorgangId,
    p_korrektur_von: beginn,
    p_begruendung: text(fd, "aenderungs_begruendung", 500),
  });
  if (error) return { error: fehler(error, "Die Berechnung konnte nicht aktualisiert werden.") };
  neuLaden();
  return { error: null, ok: beginn ? "Mit der Korrektur neu berechnet. Die Mitgliedsstammdaten bleiben unverändert." : "Korrektur entfernt und neu berechnet." };
}

export async function vorgangLoeschen(vorgangId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(vorgangId)) return { error: "Ungültiger Vorgang." };
  const { supabase } = await sitzung();
  const { error } = await supabase.from("mitglied_ehrungen").delete().eq("id", vorgangId);
  if (error) return { error: fehler(error, "Der Vorgang konnte nicht gelöscht werden.") };
  neuLaden();
  return { error: null, ok: "Gelöscht." };
}

// ---------------------------------------------------------------------------------------------
// Manuelle Ehrung
// ---------------------------------------------------------------------------------------------
export async function ehrungManuellAnlegen(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = id(fd, "verein_id");
  const vmId = id(fd, "vereins_mitglied_id");
  const artId = id(fd, "ehrungsart_id");
  const faellig = datumFeld(fd, "faellig_am");
  const status = String(fd.get("status") ?? "vorgemerkt") as Status;
  const grund = text(fd, "grundlage_text");
  if (!vereinId || !vmId) return { error: "Bitte ein Mitglied auswählen." };
  if (!artId) return { error: "Bitte eine Auszeichnung auswählen." };
  if (!grund) return { error: "Bitte einen Grund angeben." };
  if (faellig === false) return { error: "Bitte ein gültiges Datum angeben." };
  if (!["moeglich", "geprueft", "vorgemerkt", "verliehen"].includes(status)) return { error: "Bitte einen Status auswählen." };
  const verliehen = datumFeld(fd, "verliehen_am");
  if (status === "verliehen" && !verliehen) return { error: "Bitte das Verleihungsdatum angeben (z. B. für bereits früher verliehene Ehrungen)." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase
    .from("mitglied_ehrungen")
    .insert({
      verein_id: vereinId,
      vereins_mitglied_id: vmId,
      ehrungsart_id: artId,
      herkunft: "manuell_angelegt",
      status,
      grundlage_text: grund,
      faellig_am: faellig || (status === "verliehen" ? verliehen : null),
      verliehen_am: status === "verliehen" ? verliehen : null,
      verliehen_durch: status === "verliehen" ? text(fd, "verliehen_durch", 300) : null,
      interne_notiz: text(fd, "interne_notiz"),
    })
    .select("id")
    .single();
  if (error) return { error: fehler(error, "Die Ehrung konnte nicht angelegt werden.") };
  neuLaden();
  redirect(`${PFAD}/${data.id}`);
}

// ---------------------------------------------------------------------------------------------
// Mitglieds- und Taetigkeitszeiten
// ---------------------------------------------------------------------------------------------
export async function zeitraumSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = id(fd, "verein_id");
  const vmId = id(fd, "vereins_mitglied_id");
  const zeitraumId = id(fd, "id");
  const art = String(fd.get("art") ?? "");
  const von = datumFeld(fd, "von");
  const bis = datumFeld(fd, "bis");
  const funktion = text(fd, "funktion", 100);
  if (!vereinId || !vmId) return { error: "Ungültiges Mitglied." };
  if (!(art in ZEITRAUM_ART)) return { error: "Bitte die Art auswählen." };
  if (von === false || bis === false || !von) return { error: "Bitte ein gültiges Von-Datum angeben." };
  if (bis && bis < von) return { error: "Das Bis-Datum liegt vor dem Von-Datum." };
  if (art === "funktion" && !funktion) return { error: "Bitte die Funktion angeben (z. B. Trainer, Vorstand)." };
  const { supabase } = await sitzung();
  const werte = { verein_id: vereinId, vereins_mitglied_id: vmId, art, funktion: art === "funktion" ? funktion : null, von, bis, bemerkung: text(fd, "bemerkung", 500) };
  const { error } = zeitraumId
    ? await supabase.from("mitglied_zeitraeume").update(werte).eq("id", zeitraumId)
    : await supabase.from("mitglied_zeitraeume").insert(werte);
  if (error) return { error: fehler(error, "Der Zeitraum konnte nicht gespeichert werden.") };
  neuLaden();
  return { error: null, ok: "Gespeichert." };
}

export async function zeitraumLoeschen(zeitraumId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(zeitraumId)) return { error: "Ungültiger Zeitraum." };
  const { supabase } = await sitzung();
  const { error } = await supabase.from("mitglied_zeitraeume").delete().eq("id", zeitraumId);
  if (error) return { error: fehler(error, "Der Zeitraum konnte nicht gelöscht werden.") };
  neuLaden();
  return { error: null, ok: "Gelöscht." };
}

// ---------------------------------------------------------------------------------------------
// Vereinseigene Auszeichnungen und Regeln
// ---------------------------------------------------------------------------------------------
export async function auszeichnungSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = id(fd, "verein_id");
  const artId = id(fd, "id");
  const name = text(fd, "name", 200);
  const stufeNr = zahlFeld(fd, "stufe_nr");
  if (!vereinId) return { error: "Ungültiger Verein." };
  if (!name) return { error: "Bitte einen Namen angeben." };
  if (stufeNr === false) return { error: "Die Stufen-Nummer muss eine Zahl sein." };
  const pruefstatus = String(fd.get("pruefstatus") ?? "geprueft");
  const werte = {
    typ: "verein",
    verein_id: vereinId,
    name,
    kurz: text(fd, "kurz", 50),
    serie: text(fd, "serie", 200),
    stufe: text(fd, "stufe", 100),
    stufe_nr: stufeNr === null ? null : Math.round(stufeNr),
    kategorie: text(fd, "kategorie", 100),
    beschreibung: text(fd, "beschreibung"),
    voraussetzungen: text(fd, "voraussetzungen"),
    regel_verknuepfung: fd.get("regel_verknuepfung") === "alle" ? "alle" : "eine",
    automatische_vorschlaege: fd.get("automatische_vorschlaege") === "ja",
    bestellung_erforderlich: fd.get("bestellung_erforderlich") === "ja",
    symbol: text(fd, "symbol", 8),
    bemerkung: text(fd, "bemerkung"),
    aktiv: fd.get("aktiv") === "ja",
    pruefstatus: ["nicht_geprueft", "geprueft", "bestaetigt"].includes(pruefstatus) ? pruefstatus : "geprueft",
  };
  const { supabase } = await sitzung();
  if (artId) {
    const { error } = await supabase.from("ehrungsarten").update(werte).eq("id", artId).eq("typ", "verein");
    if (error) return { error: fehler(error, "Die Auszeichnung konnte nicht gespeichert werden.") };
    neuLaden();
    return { error: null, ok: "Gespeichert. Bereits verliehene Ehrungen bleiben unverändert." };
  }
  const { data, error } = await supabase.from("ehrungsarten").insert(werte).select("id").single();
  if (error) return { error: fehler(error, "Die Auszeichnung konnte nicht angelegt werden.") };
  neuLaden();
  redirect(`${PFAD}/auszeichnung/${data.id}?verein=${vereinId}`);
}

export async function regelSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const artId = id(fd, "ehrungsart_id");
  const berechnung = String(fd.get("berechnung") ?? "");
  const jahre = zahlFeld(fd, "jahre");
  const punkteMin = zahlFeld(fd, "punkte_min");
  if (!artId) return { error: "Ungültige Auszeichnung." };
  if (!(berechnung in BERECHNUNG)) return { error: "Bitte die Berechnungsart auswählen." };
  if (jahre === false || punkteMin === false) return { error: "Bitte gültige Zahlen angeben." };
  const funktion = text(fd, "funktion", 100);
  let gewichte: Record<string, number> | null = null;
  if (berechnung === "punkte") {
    gewichte = {};
    for (const k of ["mitgliedschaft", "aktiv", "ehrenamt"]) {
      const g = zahlFeld(fd, `gewicht_${k}`);
      if (g === false) return { error: "Bitte gültige Punktwerte angeben." };
      if (g) gewichte[k] = g;
    }
    const gf = zahlFeld(fd, "gewicht_funktion");
    const fname = text(fd, "gewicht_funktion_name", 100);
    if (gf === false) return { error: "Bitte gültige Punktwerte angeben." };
    if (gf && fname) gewichte[`funktion:${fname}`] = gf;
    if (!Object.keys(gewichte).length || !punkteMin) return { error: "Bitte Mindestpunkte und mindestens einen Punktwert je Jahr angeben." };
  } else if (berechnung !== "manuell") {
    if (!jahre || jahre <= 0) return { error: "Bitte die erforderlichen Jahre angeben." };
    if (berechnung === "funktion" && !funktion) return { error: "Bitte die Funktion angeben (z. B. Trainer, Vorstand)." };
  }
  const { supabase } = await sitzung();
  const { error } = await supabase.from("ehrungs_regeln").insert({
    ehrungsart_id: artId,
    berechnung,
    jahre: ["mitgliedschaft", "aktiv", "ehrenamt", "funktion"].includes(berechnung) ? jahre : null,
    funktion: berechnung === "funktion" ? funktion : null,
    punkte_min: berechnung === "punkte" ? punkteMin : null,
    punkte_gewichte: gewichte,
    ununterbrochen: fd.get("ununterbrochen") === "ja",
    bemerkung: text(fd, "bemerkung", 500),
  });
  if (error) return { error: fehler(error, "Die Regel konnte nicht gespeichert werden.") };
  neuLaden();
  return { error: null, ok: "Regel hinzugefügt." };
}

export async function regelLoeschen(regelId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(regelId)) return { error: "Ungültige Regel." };
  const { supabase } = await sitzung();
  const { error } = await supabase.from("ehrungs_regeln").delete().eq("id", regelId);
  if (error) return { error: fehler(error, "Die Regel konnte nicht gelöscht werden.") };
  neuLaden();
  return { error: null, ok: "Regel entfernt." };
}

// ---------------------------------------------------------------------------------------------
// Organisationen des Vereins (welche Verbandsauszeichnungen vorgeschlagen werden)
// ---------------------------------------------------------------------------------------------
export async function organisationenSpeichern(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = id(fd, "verein_id");
  if (!vereinId) return { error: "Ungültiger Verein." };
  const gewaehlt = fd.getAll("organisation").map(String).filter((x) => UUID.test(x));
  const { supabase } = await sitzung();
  const { data: bisher, error: e1 } = await supabase.from("verein_ehrungs_organisationen").select("organisation_id").eq("verein_id", vereinId);
  if (e1) return { error: fehler(e1, "Die Auswahl konnte nicht gespeichert werden.") };
  const alt = new Set((bisher ?? []).map((b) => b.organisation_id as string));
  const neu = new Set(gewaehlt);
  const weg = [...alt].filter((x) => !neu.has(x));
  const dazu = [...neu].filter((x) => !alt.has(x));
  if (weg.length) {
    const { error } = await supabase.from("verein_ehrungs_organisationen").delete().eq("verein_id", vereinId).in("organisation_id", weg);
    if (error) return { error: fehler(error, "Die Auswahl konnte nicht gespeichert werden.") };
  }
  if (dazu.length) {
    const { error } = await supabase.from("verein_ehrungs_organisationen").insert(dazu.map((o) => ({ verein_id: vereinId, organisation_id: o })));
    if (error) return { error: fehler(error, "Die Auswahl konnte nicht gespeichert werden.") };
  }
  neuLaden();
  return { error: null, ok: "Gespeichert." };
}

// ---------------------------------------------------------------------------------------------
// Bestellungen
// ---------------------------------------------------------------------------------------------
export async function bestellungVorbereiten(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const vereinId = id(fd, "verein_id");
  const ids = fd.getAll("vorgang").map(String).filter((x) => UUID.test(x));
  if (!vereinId) return { error: "Ungültiger Verein." };
  if (ids.length === 0) return { error: "Bitte mindestens eine Ehrung auswählen." };
  const { supabase } = await sitzung();
  const { data, error } = await supabase.rpc("ehrungen_bestellung_vorbereiten", {
    p_verein_id: vereinId,
    p_vorgaenge: ids,
    p_bezeichnung: text(fd, "bezeichnung", 200),
  });
  if (error) return { error: fehler(error, "Die Bestellung konnte nicht vorbereitet werden.") };
  neuLaden();
  redirect(`${PFAD}/bestellung/${data}?verein=${vereinId}`);
}

export async function bestellungStatus(_prev: AktionsErgebnis, fd: FormData): Promise<AktionsErgebnis> {
  const bestellungId = id(fd, "id");
  const status = String(fd.get("status") ?? "");
  const d = datumFeld(fd, "datum");
  if (!bestellungId || !["bestellt", "erhalten", "storniert"].includes(status)) return { error: "Ungültige Aktion." };
  if (d === false) return { error: "Bitte ein gültiges Datum angeben." };
  if (status === "bestellt" && fd.get("geprueft") !== "ja") return { error: "Bitte bestätigen Sie, dass Sie die Angaben vor der Bestellung geprüft haben." };
  const { supabase } = await sitzung();
  const { error } = await supabase.rpc("ehrungen_bestellung_status", {
    p_bestellung_id: bestellungId,
    p_status: status,
    p_datum: d,
    p_bestellnummer: text(fd, "bestellnummer", 100),
    p_anbieter: text(fd, "anbieter", 200),
    p_bemerkung: text(fd, "bemerkung", 1000),
    p_geprueft: fd.get("geprueft") === "ja",
  });
  if (error) return { error: fehler(error, "Die Bestellung konnte nicht aktualisiert werden.") };
  neuLaden();
  return { error: null, ok: status === "bestellt" ? "Als bestellt markiert." : status === "erhalten" ? "Als erhalten markiert." : "Bestellung storniert." };
}

// Einzelne Ehrung aus einer noch nicht bestellten Bestellung herausnehmen
export async function ausBestellungEntfernen(vorgangId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(vorgangId)) return { error: "Ungültiger Vorgang." };
  const { supabase } = await sitzung();
  const { data: v } = await supabase.from("mitglied_ehrungen").select("status, bestellung_id, ehrungs_bestellungen(status)").eq("id", vorgangId).maybeSingle();
  // deno-lint-ignore no-explicit-any
  if (!v?.bestellung_id || (v as any).ehrungs_bestellungen?.status !== "vorbereitet") return { error: "Nur aus Bestellungen in Vorbereitung möglich." };
  const { error } = await supabase
    .from("mitglied_ehrungen")
    .update({ bestellung_id: null, aenderungs_begruendung: "Aus Bestellung entfernt" })
    .eq("id", vorgangId);
  if (error) return { error: fehler(error, "Die Ehrung konnte nicht entfernt werden.") };
  neuLaden();
  return { error: null, ok: "Entfernt." };
}

// ---------------------------------------------------------------------------------------------
// Dokumente (Datei wird im Browser direkt in den privaten Bucket geladen, hier nur registriert)
// ---------------------------------------------------------------------------------------------
export async function dokumentRegistrieren(eingabe: {
  vereinId: string;
  vorgangId: string;
  art: string;
  name: string;
  pfad: string;
  mime: string;
  groesse: number;
}): Promise<AktionsErgebnis> {
  if (!UUID.test(eingabe.vereinId) || !UUID.test(eingabe.vorgangId)) return { error: "Ungültige Angaben." };
  if (!["urkunde", "foto", "dokument"].includes(eingabe.art)) return { error: "Ungültige Dokumentart." };
  if (!eingabe.pfad.startsWith(`${eingabe.vereinId}/${eingabe.vorgangId}/`)) return { error: "Ungültiger Speicherort." };
  const { supabase } = await sitzung();
  const { error } = await supabase.from("mitglied_ehrung_dokumente").insert({
    verein_id: eingabe.vereinId,
    mitglied_ehrung_id: eingabe.vorgangId,
    art: eingabe.art,
    name: eingabe.name.slice(0, 200),
    storage_path: eingabe.pfad,
    mime_type: eingabe.mime,
    groesse_bytes: Math.max(0, Math.round(eingabe.groesse)),
  });
  if (error) {
    await supabase.storage.from("ehrungs-dokumente").remove([eingabe.pfad]);
    return { error: fehler(error, "Das Dokument konnte nicht gespeichert werden.") };
  }
  neuLaden();
  return { error: null, ok: "Dokument gespeichert." };
}

export async function dokumentLoeschen(dokumentId: string): Promise<AktionsErgebnis> {
  if (!UUID.test(dokumentId)) return { error: "Ungültiges Dokument." };
  const { supabase } = await sitzung();
  const { data: d } = await supabase.from("mitglied_ehrung_dokumente").select("storage_path").eq("id", dokumentId).maybeSingle();
  if (!d) return { error: "Das Dokument wurde nicht gefunden." };
  const { error } = await supabase.from("mitglied_ehrung_dokumente").delete().eq("id", dokumentId);
  if (error) return { error: fehler(error, "Das Dokument konnte nicht gelöscht werden.") };
  await supabase.storage.from("ehrungs-dokumente").remove([d.storage_path]);
  neuLaden();
  return { error: null, ok: "Gelöscht." };
}
