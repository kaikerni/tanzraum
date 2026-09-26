import type { SupabaseClient } from "@supabase/supabase-js";
import type { VereinsMitgliedschaft } from "@/lib/dashboard/getDashboardData";
import type { Auszeichnung, Grundlage, Regel, Vorgang } from "./typen";

// Nur Vereine, in denen die angemeldete Person Vereinsadmin ist (Datenbank prueft zusaetzlich per RLS).
export function adminVereine(vereine: VereinsMitgliedschaft[]): VereinsMitgliedschaft[] {
  return vereine.filter((v) => v.istAdmin && !v.vereinGesperrt);
}

export function waehleVerein(vereine: VereinsMitgliedschaft[], gewaehlt?: string): VereinsMitgliedschaft | null {
  return vereine.find((v) => v.vereinId === gewaehlt) ?? vereine[0] ?? null;
}

// deno-lint-ignore no-explicit-any
function alsRegel(r: any): Regel {
  return {
    id: r.id,
    ehrungsartId: r.ehrungsart_id,
    berechnung: r.berechnung,
    jahre: r.jahre === null ? null : Number(r.jahre),
    funktion: r.funktion,
    punkteMin: r.punkte_min === null ? null : Number(r.punkte_min),
    punkteGewichte: r.punkte_gewichte,
    ununterbrochen: r.ununterbrochen,
    bemerkung: r.bemerkung,
  };
}

const ART_FELDER =
  "id, typ, organisation_id, verein_id, serie, name, kurz, beschreibung, kategorie, stufe, stufe_nr, voraussetzungen, regel_verknuepfung, automatische_vorschlaege, antrag_erforderlich, bestellung_erforderlich, symbol, bemerkung, aktiv, pruefstatus, geprueft_am, quelle, quelle_url, pruef_bemerkung, naechste_pruefung, ehrungs_organisationen(name), ehrungs_regeln(*)";

// deno-lint-ignore no-explicit-any
function alsAuszeichnung(a: any): Auszeichnung {
  return {
    id: a.id,
    typ: a.typ,
    organisationId: a.organisation_id,
    organisation: a.ehrungs_organisationen?.name ?? null,
    vereinId: a.verein_id,
    serie: a.serie,
    name: a.name,
    kurz: a.kurz,
    beschreibung: a.beschreibung,
    kategorie: a.kategorie,
    stufe: a.stufe,
    stufeNr: a.stufe_nr,
    voraussetzungen: a.voraussetzungen,
    regelVerknuepfung: a.regel_verknuepfung,
    automatischeVorschlaege: a.automatische_vorschlaege,
    antragErforderlich: a.antrag_erforderlich,
    bestellungErforderlich: a.bestellung_erforderlich,
    symbol: a.symbol,
    bemerkung: a.bemerkung,
    aktiv: a.aktiv,
    pruefstatus: a.pruefstatus,
    gepruefAm: a.geprueft_am,
    quelle: a.quelle,
    quelleUrl: a.quelle_url,
    pruefBemerkung: a.pruef_bemerkung,
    naechstePruefung: a.naechste_pruefung,
    // deno-lint-ignore no-explicit-any
    regeln: ((a.ehrungs_regeln ?? []) as any[]).sort((x, y) => x.sortierung - y.sortierung).map(alsRegel),
  };
}

function sortiereArten(a: Auszeichnung, b: Auszeichnung): number {
  return (
    (a.organisation ?? "").localeCompare(b.organisation ?? "", "de") ||
    (a.serie ?? a.name).localeCompare(b.serie ?? b.name, "de") ||
    (a.stufeNr ?? 0) - (b.stufeNr ?? 0) ||
    a.name.localeCompare(b.name, "de")
  );
}

// Vereinseigene Auszeichnungen + Verbandsauszeichnungen der Organisationen, denen der Verein angehoert
export async function getAuszeichnungen(supabase: SupabaseClient, vereinId: string): Promise<{ verein: Auszeichnung[]; verband: Auszeichnung[] }> {
  const [{ data: eigene }, { data: orgs }] = await Promise.all([
    supabase.from("ehrungsarten").select(ART_FELDER).eq("typ", "verein").eq("verein_id", vereinId),
    supabase.from("verein_ehrungs_organisationen").select("organisation_id").eq("verein_id", vereinId),
  ]);
  const orgIds = (orgs ?? []).map((o) => o.organisation_id as string);
  const { data: verband } = orgIds.length
    ? await supabase.from("ehrungsarten").select(ART_FELDER).eq("typ", "verband").in("organisation_id", orgIds)
    : { data: [] };
  return {
    verein: (eigene ?? []).map(alsAuszeichnung).sort(sortiereArten),
    verband: (verband ?? []).map(alsAuszeichnung).sort(sortiereArten),
  };
}

export async function getAuszeichnung(supabase: SupabaseClient, id: string): Promise<Auszeichnung | null> {
  const { data } = await supabase.from("ehrungsarten").select(ART_FELDER).eq("id", id).maybeSingle();
  return data ? alsAuszeichnung(data) : null;
}

export type Organisation = {
  id: string;
  name: string;
  kuerzel: string | null;
  art: string;
  beschreibung: string | null;
  pruefstatus: string;
  aktiv: boolean;
  gewaehlt: boolean;
  anzahlAuszeichnungen: number;
};

export async function getOrganisationen(supabase: SupabaseClient, vereinId: string): Promise<Organisation[]> {
  const [{ data: orgs }, { data: gewaehlt }, { data: arten }] = await Promise.all([
    supabase.from("ehrungs_organisationen").select("id, name, kuerzel, art, beschreibung, pruefstatus, aktiv").order("name"),
    supabase.from("verein_ehrungs_organisationen").select("organisation_id").eq("verein_id", vereinId),
    supabase.from("ehrungsarten").select("organisation_id").eq("typ", "verband"),
  ]);
  const set = new Set((gewaehlt ?? []).map((g) => g.organisation_id as string));
  const anzahl = new Map<string, number>();
  for (const a of arten ?? []) anzahl.set(a.organisation_id as string, (anzahl.get(a.organisation_id as string) ?? 0) + 1);
  const rang: Record<string, number> = { dachverband: 0, regionalverband: 1, traditionsverband: 2, sonstige: 3 };
  return (orgs ?? [])
    .map((o) => ({
      id: o.id,
      name: o.name,
      kuerzel: o.kuerzel,
      art: o.art,
      beschreibung: o.beschreibung,
      pruefstatus: o.pruefstatus,
      aktiv: o.aktiv,
      gewaehlt: set.has(o.id),
      anzahlAuszeichnungen: anzahl.get(o.id) ?? 0,
    }))
    .sort((a, b) => (rang[a.art] ?? 9) - (rang[b.art] ?? 9) || a.name.localeCompare(b.name, "de"));
}

const VORGANG_FELDER =
  "*, art:ehrungsarten!mitglied_ehrungen_ehrungsart_id_fkey(name, typ, serie, stufe, kategorie, bestellung_erforderlich, pruefstatus, ehrungs_organisationen(name)), auto:ehrungsarten!mitglied_ehrungen_auto_ehrungsart_id_fkey(name)";

// deno-lint-ignore no-explicit-any
function alsVorgang(v: any): Vorgang {
  return {
    id: v.id,
    vereinId: v.verein_id,
    vereinsMitgliedId: v.vereins_mitglied_id,
    personName: v.person_name,
    ehrungsartId: v.ehrungsart_id,
    auszeichnung: v.art?.name ?? "–",
    typ: v.art?.typ ?? "verein",
    organisation: v.art?.ehrungs_organisationen?.name ?? null,
    serie: v.art?.serie ?? null,
    stufe: v.art?.stufe ?? null,
    kategorie: v.art?.kategorie ?? null,
    bestellungErforderlich: v.art?.bestellung_erforderlich ?? true,
    pruefstatus: v.art?.pruefstatus ?? "nicht_geprueft",
    herkunft: v.herkunft,
    autoEhrungsartId: v.auto_ehrungsart_id,
    autoAuszeichnung: v.auto?.name ?? null,
    autoFaelligAm: v.auto_faellig_am,
    autoGrundlage: v.auto_grundlage as Grundlage | null,
    faelligAm: v.faellig_am,
    faelligJahr: v.faellig_jahr,
    grundlage: v.grundlage as Grundlage | null,
    grundlageText: v.grundlage_text,
    korrektur: v.korrektur,
    status: v.status,
    begruendung: v.begruendung,
    interneNotiz: v.interne_notiz,
    wunschDatum: v.wunsch_datum,
    anlass: v.anlass,
    veranstaltung: v.veranstaltung,
    bestellungId: v.bestellung_id,
    bestelltAm: v.bestellt_am,
    erhaltenAm: v.erhalten_am,
    eingeplantAm: v.eingeplant_am,
    verliehenAm: v.verliehen_am,
    verliehenDurch: v.verliehen_durch,
    verleihungBemerkung: v.verleihung_bemerkung,
    snapshot: v.snapshot,
    updatedAt: v.updated_at,
  };
}

export async function getVorgaenge(supabase: SupabaseClient, vereinId: string): Promise<Vorgang[]> {
  const { data } = await supabase
    .from("mitglied_ehrungen")
    .select(VORGANG_FELDER)
    .eq("verein_id", vereinId)
    .order("faellig_am", { ascending: true, nullsFirst: false });
  return (data ?? []).map(alsVorgang);
}

export async function getVorgang(supabase: SupabaseClient, id: string): Promise<Vorgang | null> {
  const { data } = await supabase.from("mitglied_ehrungen").select(VORGANG_FELDER).eq("id", id).maybeSingle();
  return data ? alsVorgang(data) : null;
}

export type HistorieEintrag = {
  id: number;
  aktion: string;
  alt: Record<string, unknown> | null;
  neu: Record<string, unknown> | null;
  begruendung: string | null;
  von: string | null;
  am: string;
};

export async function getHistorie(supabase: SupabaseClient, vorgangId: string): Promise<HistorieEintrag[]> {
  const { data } = await supabase
    .from("ehrungs_historie")
    .select("id, aktion, alt, neu, begruendung, von, am")
    .eq("mitglied_ehrung_id", vorgangId)
    .order("am", { ascending: false })
    .order("id", { ascending: false });
  const eintraege = (data ?? []) as HistorieEintrag[];
  const ids = [...new Set(eintraege.map((e) => e.von).filter(Boolean))] as string[];
  const namen = new Map<string, string>();
  if (ids.length) {
    const { data: n } = await supabase.rpc("anzeige_namen", { p_user_ids: ids });
    for (const x of (n ?? []) as { user_id: string; anzeige: string }[]) namen.set(x.user_id, x.anzeige);
  }
  return eintraege.map((e) => ({ ...e, von: e.von ? (namen.get(e.von) ?? "Vereinsadmin") : "TanzRaum (automatisch)" }));
}

export type Zeitraum = {
  id: string;
  vereinsMitgliedId: string;
  art: "mitgliedschaft" | "aktiv" | "funktion" | "ehrenamt";
  funktion: string | null;
  von: string;
  bis: string | null;
  bemerkung: string | null;
};

export async function getZeitraeume(supabase: SupabaseClient, vereinId: string, vmId?: string): Promise<Zeitraum[]> {
  let q = supabase.from("mitglied_zeitraeume").select("id, vereins_mitglied_id, art, funktion, von, bis, bemerkung").eq("verein_id", vereinId);
  if (vmId) q = q.eq("vereins_mitglied_id", vmId);
  const { data } = await q.order("von");
  return (data ?? []).map((z) => ({
    id: z.id,
    vereinsMitgliedId: z.vereins_mitglied_id,
    art: z.art,
    funktion: z.funktion,
    von: z.von,
    bis: z.bis,
    bemerkung: z.bemerkung,
  }));
}

export type Bestellung = {
  id: string;
  bezeichnung: string;
  status: "vorbereitet" | "bestellt" | "erhalten" | "storniert";
  bestelltAm: string | null;
  geliefertAm: string | null;
  bestellnummer: string | null;
  anbieter: string | null;
  bemerkung: string | null;
  createdAt: string;
};

// deno-lint-ignore no-explicit-any
function alsBestellung(b: any): Bestellung {
  return {
    id: b.id,
    bezeichnung: b.bezeichnung,
    status: b.status,
    bestelltAm: b.bestellt_am,
    geliefertAm: b.geliefert_am,
    bestellnummer: b.bestellnummer,
    anbieter: b.anbieter,
    bemerkung: b.bemerkung,
    createdAt: b.created_at,
  };
}

export async function getBestellungen(supabase: SupabaseClient, vereinId: string): Promise<Bestellung[]> {
  const { data } = await supabase.from("ehrungs_bestellungen").select("*").eq("verein_id", vereinId).order("created_at", { ascending: false });
  return (data ?? []).map(alsBestellung);
}

export async function getBestellung(supabase: SupabaseClient, id: string): Promise<(Bestellung & { vereinId: string }) | null> {
  const { data } = await supabase.from("ehrungs_bestellungen").select("*").eq("id", id).maybeSingle();
  return data ? { ...alsBestellung(data), vereinId: data.verein_id } : null;
}

// Mengenuebersicht: Auszeichnung -> Stueckzahl
export function mengen(vorgaenge: Vorgang[]): { auszeichnung: string; organisation: string | null; typ: Vorgang["typ"]; anzahl: number }[] {
  const m = new Map<string, { auszeichnung: string; organisation: string | null; typ: Vorgang["typ"]; anzahl: number }>();
  for (const v of vorgaenge) {
    const k = v.ehrungsartId;
    const e = m.get(k) ?? { auszeichnung: v.auszeichnung, organisation: v.organisation, typ: v.typ, anzahl: 0 };
    e.anzahl += 1;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.anzahl - a.anzahl || a.auszeichnung.localeCompare(b.auszeichnung, "de"));
}

export type Dokument = { id: string; art: "urkunde" | "foto" | "dokument"; name: string; mimeType: string | null; groesse: number; url: string | null; hochgeladenAm: string };

export async function getDokumente(supabase: SupabaseClient, vorgangId: string): Promise<Dokument[]> {
  const { data } = await supabase
    .from("mitglied_ehrung_dokumente")
    .select("id, art, name, storage_path, mime_type, groesse_bytes, hochgeladen_am")
    .eq("mitglied_ehrung_id", vorgangId)
    .order("hochgeladen_am");
  const liste = data ?? [];
  const pfade = liste.map((d) => d.storage_path as string);
  const { data: signiert } = pfade.length ? await supabase.storage.from("ehrungs-dokumente").createSignedUrls(pfade, 600) : { data: [] };
  const urls = new Map((signiert ?? []).map((s) => [s.path, s.signedUrl]));
  return liste.map((d) => ({
    id: d.id,
    art: d.art,
    name: d.name,
    mimeType: d.mime_type,
    groesse: Number(d.groesse_bytes ?? 0),
    url: urls.get(d.storage_path) ?? null,
    hochgeladenAm: d.hochgeladen_am,
  }));
}
