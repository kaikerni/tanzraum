import type { SupabaseClient } from "@supabase/supabase-js";
import { getTrainingKalender, plusTage } from "@/lib/training/getTraining";

export type TerminArt = "privat" | "veranstaltung" | "auftritt" | "sitzung" | "sonstiges";
export type Rueckmeldung = "zugesagt" | "abgesagt" | "vielleicht";
export type Zielgruppe = "verein" | "gruppen" | "leitung";
export type EintragTyp = "training" | "termin" | "sitzung" | "turnier" | "privat";

export const ART_LABEL: Record<TerminArt, string> = {
  privat: "Privat",
  veranstaltung: "Veranstaltung",
  auftritt: "Auftritt",
  sitzung: "Sitzung",
  sonstiges: "Sonstiges",
};

export type RueckmeldePerson = { vmId: string; name: string; ich: boolean; status: Rueckmeldung | null };

export type Termin = {
  id: string;
  vereinId: string | null;
  vereinName: string | null;
  art: TerminArt;
  titel: string;
  beschreibung: string | null;
  ort: string | null;
  datum: string;
  bisDatum: string | null;
  von: string | null;
  bis: string | null;
  zielgruppe: Zielgruppe;
  gruppen: string[];
  rueckmeldung: boolean;
  darfBearbeiten: boolean;
  personen: RueckmeldePerson[];
  zusagen: number;
  absagen: number;
  vielleicht: number;
};

// Einheitlicher Kalendereintrag fuer Monatsraster und Tagesliste.
export type KalenderEintrag = {
  schluessel: string;
  typ: EintragTyp;
  datum: string;
  bisDatum: string | null;
  von: string | null;
  bis: string | null;
  titel: string;
  untertitel: string | null;
  ort: string | null;
  href: string | null;
  extern: boolean;
  hinweis: string | null;
};

export type Turniertag = {
  id: string;
  name: string;
  ort: string | null;
  typ: string | null;
  kategorie: string | null;
  ausschreibungUrl: string | null;
  datum: string;
  tagNr: number;
  tageGesamt: number;
  eigenes: boolean;
  unsereStarts: number;
};

const zeit = (t: unknown) => (t ? String(t).slice(0, 5) : null);

// deno-lint-ignore no-explicit-any
function termin(t: any): Termin {
  return {
    id: t.id,
    vereinId: t.verein_id,
    vereinName: t.verein_name,
    art: t.art,
    titel: t.titel,
    beschreibung: t.beschreibung,
    ort: t.ort,
    datum: t.datum,
    bisDatum: t.bis_datum,
    von: zeit(t.von),
    bis: zeit(t.bis),
    zielgruppe: t.zielgruppe,
    gruppen: t.gruppen ?? [],
    rueckmeldung: t.rueckmeldung,
    darfBearbeiten: t.darf_bearbeiten,
    // deno-lint-ignore no-explicit-any
    personen: (t.personen ?? []).map((p: any) => ({ vmId: p.vm_id, name: p.name, ich: p.ich, status: p.status })),
    zusagen: t.zusagen,
    absagen: t.absagen,
    vielleicht: t.vielleicht,
  };
}

export async function getTermine(supabase: SupabaseClient, von: string, bis: string): Promise<Termin[]> {
  const { data, error } = await supabase.rpc("kalender_termine", { p_von: von, p_bis: bis });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map(termin);
}

export async function getTermin(supabase: SupabaseClient, id: string): Promise<Termin | null> {
  const { data: zeile } = await supabase.from("termine").select("datum").eq("id", id).maybeSingle();
  if (!zeile) return null;
  const liste = await getTermine(supabase, zeile.datum, zeile.datum);
  return liste.find((t) => t.id === id) ?? null;
}

export async function getTurniertage(supabase: SupabaseClient, von: string, bis: string): Promise<Turniertag[]> {
  const { data, error } = await supabase.rpc("kalender_turniere", { p_von: von, p_bis: bis });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    ort: t.ort,
    typ: t.typ,
    kategorie: t.kategorie,
    ausschreibungUrl: t.ausschreibung_url,
    datum: t.datum,
    tagNr: t.tag_nr,
    tageGesamt: t.tage_gesamt,
    eigenes: !!t.eigenes,
    unsereStarts: t.unsere_starts ?? 0,
  }));
}

export type Teilnehmer = { vmId: string; name: string; status: Rueckmeldung | null; kommentar: string | null };

export async function getTeilnehmer(supabase: SupabaseClient, terminId: string): Promise<Teilnehmer[]> {
  const { data } = await supabase.rpc("termin_teilnehmer", { p_termin_id: terminId });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((t) => ({ vmId: t.vm_id, name: t.name, status: t.status, kommentar: t.kommentar }));
}

function rueckmeldeHinweis(t: Termin): string | null {
  if (!t.rueckmeldung || t.personen.length === 0) return null;
  const offen = t.personen.filter((p) => !p.status).length;
  return offen > 0 ? "Rückmeldung offen" : null;
}

// Alle Eintraege eines Zeitraums (max. 62 Tage wegen training_kalender) aus Trainings, Terminen und Turnieren.
export async function getKalenderEintraege(supabase: SupabaseClient, von: string, bis: string): Promise<KalenderEintrag[]> {
  const [trainings, termine, turniere] = await Promise.all([
    getTrainingKalender(supabase, von, bis),
    getTermine(supabase, von, bis),
    getTurniertage(supabase, von, bis),
  ]);

  const eintraege: KalenderEintrag[] = [];

  for (const t of trainings) {
    const alleAbgemeldet = t.personen.length > 0 && t.personen.every((p) => p.abgemeldet);
    const kinder = t.personen.filter((p) => !p.ich).map((p) => p.name);
    eintraege.push({
      schluessel: `training-${t.terminId}-${t.datum}`,
      typ: "training",
      datum: t.datum,
      bisDatum: null,
      von: t.von,
      bis: t.bis,
      titel: t.titel || `Training ${t.gruppeName}`,
      untertitel: [t.titel ? t.gruppeName : null, t.vereinName, kinder.length ? kinder.join(", ") : null].filter(Boolean).join(" · "),
      ort: t.halle,
      href: "/dashboard/training",
      extern: false,
      hinweis: alleAbgemeldet ? "abgemeldet" : null,
    });
  }

  for (const t of termine) {
    eintraege.push({
      schluessel: `termin-${t.id}`,
      typ: t.art === "privat" ? "privat" : t.art === "sitzung" ? "sitzung" : "termin",
      datum: t.datum,
      bisDatum: t.bisDatum,
      von: t.von,
      bis: t.bis,
      titel: t.titel,
      untertitel: [ART_LABEL[t.art], t.vereinName, t.gruppen.length ? t.gruppen.join(", ") : null].filter(Boolean).join(" · "),
      ort: t.ort,
      href: `/dashboard/kalender/termin/${t.id}`,
      extern: false,
      hinweis: rueckmeldeHinweis(t),
    });
  }

  for (const t of turniere) {
    eintraege.push({
      schluessel: `turnier-${t.id}-${t.datum}`,
      typ: "turnier",
      datum: t.datum,
      bisDatum: null,
      von: null,
      bis: null,
      titel: t.name,
      untertitel: [t.kategorie, t.tageGesamt > 1 ? `Tag ${t.tagNr} von ${t.tageGesamt}` : null].filter(Boolean).join(" · ") || null,
      ort: t.ort,
      href: `/dashboard/turniere/${t.id}`,
      extern: false,
      hinweis: t.unsereStarts > 0 ? (t.unsereStarts === 1 ? "Wir starten" : `Wir starten (${t.unsereStarts}×)`) : t.eigenes ? "Vereinsturnier" : null,
    });
  }

  return eintraege.sort((a, b) => (a.datum + (a.von ?? "")).localeCompare(b.datum + (b.von ?? "")));
}

export function monatsRaster(monat: string): { von: string; bis: string } {
  const erster = `${monat}-01`;
  const wochentag = (new Date(`${erster}T12:00:00Z`).getUTCDay() + 6) % 7; // Montag = 0
  const von = plusTage(erster, -wochentag);
  return { von, bis: plusTage(von, 41) };
}

export type TerminZielDaten = { vereinId: string; vereinName: string; gruppen: { id: string; name: string }[] };

// Vereine, in denen man Vereinstermine anlegen darf (Vereinsadmin oder Bereich "saison", nur mit Lizenz).
export async function getTerminZiele(supabase: SupabaseClient): Promise<TerminZielDaten[]> {
  const { data: bereiche } = await supabase.rpc("meine_bereiche");
  const ids = [
    ...new Set(
      // deno-lint-ignore no-explicit-any
      ((bereiche ?? []) as any[]).filter((b) => b.bereich === "saison" || b.bereich === "rolle_admin").map((b) => b.verein_id as string),
    ),
  ];
  if (ids.length === 0) return [];
  const [{ data: vereine }, { data: gruppen }] = await Promise.all([
    supabase.from("vereine").select("id, name").in("id", ids).order("name"),
    supabase.from("gruppen").select("id, name, verein_id").in("verein_id", ids).order("name"),
  ]);
  return (vereine ?? []).map((v) => ({
    vereinId: v.id,
    vereinName: v.name,
    gruppen: (gruppen ?? []).filter((g) => g.verein_id === v.id).map((g) => ({ id: g.id, name: g.name })),
  }));
}

export async function getMeinTarif(supabase: SupabaseClient): Promise<"free" | "basic" | "verein"> {
  const { data } = await supabase.rpc("mein_tarif");
  return data === "basic" || data === "verein" ? data : "free";
}
