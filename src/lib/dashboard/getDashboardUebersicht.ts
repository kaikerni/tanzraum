import type { SupabaseClient } from "@supabase/supabase-js";

// Alle Abfragen laufen ueber die dashboard_*-Funktionen: Plattform-Admin sieht alle Vereine,
// alle anderen nur Vereine, in denen sie den jeweiligen Bereich haben. Fehlt das Recht, kommt null/leer.

type Verlauf = number[];

export type DashboardKennzahlen = {
  mitglieder: { wert: number; neuWoche: number; vereine: number; verlauf: Verlauf } | null;
  trainingsHeute: { wert: number; erwartet: number; verlauf: Verlauf } | null;
  abmeldungenHeute: { wert: number; verlauf: Verlauf } | null;
  turniereWoche: {
    wert: number;
    erstesName: string | null;
    erstesOrt: string | null;
    erstesDatum: string | null;
    verlauf: Verlauf;
  } | null;
  nachrichten: { ungelesen: number; verlauf: Verlauf } | null;
  beteiligung: { prozent: number | null; vormonat: number | null; verlauf: (number | null)[] } | null;
};

function zahlen(v: unknown): number[] {
  return Array.isArray(v) ? v.map((x) => Number(x ?? 0)) : [];
}

export async function getKennzahlen(supabase: SupabaseClient): Promise<DashboardKennzahlen | null> {
  const { data, error } = await supabase.rpc("dashboard_kennzahlen");
  if (error || !data) return null;
  // deno-lint-ignore no-explicit-any
  const d = data as any;
  return {
    mitglieder: d.mitglieder && {
      wert: Number(d.mitglieder.wert),
      neuWoche: Number(d.mitglieder.neu_woche),
      vereine: Number(d.mitglieder.vereine),
      verlauf: zahlen(d.mitglieder.verlauf),
    },
    trainingsHeute: d.trainings_heute && {
      wert: Number(d.trainings_heute.wert),
      erwartet: Number(d.trainings_heute.erwartet),
      verlauf: zahlen(d.trainings_heute.verlauf),
    },
    abmeldungenHeute: d.abmeldungen_heute && {
      wert: Number(d.abmeldungen_heute.wert),
      verlauf: zahlen(d.abmeldungen_heute.verlauf),
    },
    turniereWoche: d.turniere_woche && {
      wert: Number(d.turniere_woche.wert),
      erstesName: d.turniere_woche.erstes_name,
      erstesOrt: d.turniere_woche.erstes_ort,
      erstesDatum: d.turniere_woche.erstes_datum,
      verlauf: zahlen(d.turniere_woche.verlauf),
    },
    nachrichten: d.nachrichten && {
      ungelesen: Number(d.nachrichten.ungelesen),
      verlauf: zahlen(d.nachrichten.verlauf),
    },
    beteiligung: d.beteiligung && {
      prozent: d.beteiligung.prozent === null ? null : Number(d.beteiligung.prozent),
      vormonat: d.beteiligung.vormonat === null ? null : Number(d.beteiligung.vormonat),
      verlauf: Array.isArray(d.beteiligung.verlauf)
        ? d.beteiligung.verlauf.map((x: unknown) => (x === null ? null : Number(x)))
        : [],
    },
  };
}

export type Termin = {
  typ: "training" | "turnier";
  titel: string;
  ort: string | null;
  datum: string | null;
  von: string | null;
  bis: string | null;
  wiederholend: boolean;
  wochentag: number | null;
};

export async function getNaechsteTermine(supabase: SupabaseClient, anzahl = 6): Promise<Termin[]> {
  const { data, error } = await supabase.rpc("dashboard_naechste_termine", { p_anzahl: anzahl });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((t) => ({
    typ: t.typ,
    titel: t.titel,
    ort: t.ort,
    datum: t.datum,
    von: t.von,
    bis: t.bis,
    wiederholend: t.wiederholend,
    wochentag: t.wochentag,
  }));
}

export type NaechstesTurnier = {
  id: string;
  name: string;
  ort: string | null;
  ersterTag: string;
  anzahlTage: number;
  neu: boolean;
};

export async function getNaechsteTurniere(supabase: SupabaseClient, anzahl = 4): Promise<NaechstesTurnier[]> {
  const { data, error } = await supabase.rpc("dashboard_naechste_turniere", { p_anzahl: anzahl });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    ort: t.ort,
    ersterTag: t.erster_tag,
    anzahlTage: Number(t.anzahl_tage),
    neu: Boolean(t.neu),
  }));
}

export type AltersklassenVerteilung = { altersklasse: string; anzahl: number };

export async function getAltersklassen(supabase: SupabaseClient): Promise<AltersklassenVerteilung[]> {
  const { data, error } = await supabase.rpc("dashboard_altersklassen");
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((r) => ({ altersklasse: r.altersklasse, anzahl: Number(r.anzahl) }));
}

export type HeuteEintrag = {
  titel: string;
  gruppeName: string | null;
  halle: string | null;
  von: string | null;
  bis: string | null;
  vereinName: string;
  teilnehmerErwartet: number | null;
  teilnehmerGesamt: number | null;
};

export async function getHeute(supabase: SupabaseClient): Promise<HeuteEintrag[]> {
  const { data, error } = await supabase.rpc("dashboard_heute");
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((r) => ({
    titel: r.titel,
    gruppeName: r.gruppe_name,
    halle: r.halle,
    von: r.von,
    bis: r.bis,
    vereinName: r.verein_name,
    teilnehmerErwartet: r.teilnehmer_erwartet,
    teilnehmerGesamt: r.teilnehmer_gesamt,
  }));
}

export type WochenBeteiligung = { wocheStart: string; prozent: number | null };

export async function getBeteiligungVerlauf(
  supabase: SupabaseClient,
  wochen = 8,
): Promise<WochenBeteiligung[]> {
  const { data, error } = await supabase.rpc("dashboard_beteiligung_verlauf", { p_wochen: wochen });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((r) => ({
    wocheStart: r.woche_start,
    prozent: r.prozent === null ? null : Number(r.prozent),
  }));
}

export type RadarEintrag = {
  typ: "beitrag" | "abmeldung" | "turnier" | "datei" | string;
  dringlichkeit: "hoch" | "mittel" | "info" | "neu";
  titel: string;
  untertitel: string | null;
};

export async function getRadar(supabase: SupabaseClient): Promise<RadarEintrag[]> {
  const { data, error } = await supabase.rpc("dashboard_radar");
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((r) => ({
    typ: r.typ,
    dringlichkeit: r.dringlichkeit,
    titel: r.titel,
    untertitel: r.untertitel,
  }));
}
