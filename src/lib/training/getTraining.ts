import type { SupabaseClient } from "@supabase/supabase-js";

// Eigene Person bzw. eigenes Kind in diesem Training (Standard: eingeplant; abgemeldet nur mit Abmeldung)
export type TrainingPerson = {
  vmId: string;
  name: string;
  ich: boolean;
  abgemeldet: boolean;
  grund: string | null;
  kategorie: string | null;
  hinweis: string | null;
};

// Abmeldung fuer die Trainer-/Betreuer-Sicht (nur fuer betreute Gruppen, siehe training_kalender)
export type TrainingsAbmeldung = {
  vmId: string;
  name: string;
  kategorie: string | null;
  hinweis: string | null;
  grund: string | null;
  erstelltAm: string;
};

export type TrainingsTag = {
  terminId: string;
  vereinId: string;
  vereinName: string;
  gruppeId: string;
  gruppeName: string;
  datum: string;
  von: string;
  bis: string;
  halle: string | null;
  titel: string | null;
  wiederholend: boolean;
  darfVerwalten: boolean;
  darfAnwesenheit: boolean;
  personen: TrainingPerson[];
  // null = keine Trainer-/Betreuer-Sicht auf diese Gruppe
  abmeldungen: TrainingsAbmeldung[] | null;
};

export type TrainingsTeilnehmer = { vmId: string; name: string; abgemeldet: boolean; kategorie: string | null; hinweis: string | null };

export type AnwesenheitsEintrag = {
  vmId: string;
  name: string;
  abgemeldet: boolean;
  grund: string | null;
  anwesend: boolean | null;
};

export type BetreuteGruppe = { gruppeId: string; gruppeName: string; vereinId: string; vereinName: string };

export type TrainingsSerie = {
  id: string;
  gruppeId: string;
  gruppeName: string;
  wiederholend: boolean;
  wochentag: number | null;
  datum: string | null;
  von: string;
  bis: string;
  halle: string | null;
  titel: string | null;
};

export function heuteBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function plusTage(iso: string, tage: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

export async function getTrainingKalender(supabase: SupabaseClient, von: string, bis: string): Promise<TrainingsTag[]> {
  const { data, error } = await supabase.rpc("training_kalender", { p_von: von, p_bis: bis });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((t) => ({
    terminId: t.termin_id,
    vereinId: t.verein_id,
    vereinName: t.verein_name,
    gruppeId: t.gruppe_id,
    gruppeName: t.gruppe_name,
    datum: t.datum,
    von: String(t.von).slice(0, 5),
    bis: String(t.bis).slice(0, 5),
    halle: t.halle,
    titel: t.titel,
    wiederholend: t.wiederholend,
    darfVerwalten: t.darf_verwalten,
    darfAnwesenheit: t.darf_anwesenheit,
    // deno-lint-ignore no-explicit-any
    personen: (t.personen ?? []).map((p: any) => ({
      vmId: p.vm_id,
      name: p.name,
      ich: p.ich,
      abgemeldet: p.abgemeldet,
      grund: p.grund,
      kategorie: p.kategorie ?? null,
      hinweis: p.hinweis ?? null,
    })),
    abmeldungen: Array.isArray(t.abmeldungen)
      ? // deno-lint-ignore no-explicit-any
        (t.abmeldungen as any[]).map((a) => ({
          vmId: a.vm_id,
          name: a.name,
          kategorie: a.kategorie ?? null,
          hinweis: a.hinweis ?? null,
          grund: a.grund ?? null,
          erstelltAm: a.erstellt_am,
        }))
      : null,
  }));
}

export async function getAnwesenheitListe(
  supabase: SupabaseClient,
  gruppeId: string,
  datum: string,
): Promise<AnwesenheitsEintrag[] | null> {
  const { data, error } = await supabase.rpc("anwesenheit_liste", { p_gruppe_id: gruppeId, p_datum: datum });
  if (error) return null;
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((e) => ({
    vmId: e.vm_id,
    name: e.name,
    abgemeldet: e.abgemeldet,
    grund: e.grund,
    anwesend: e.anwesend,
  }));
}

export async function getBetreuteGruppen(supabase: SupabaseClient): Promise<BetreuteGruppe[]> {
  const { data } = await supabase.rpc("meine_betreuten_gruppen");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((g) => ({
    gruppeId: g.gruppe_id,
    gruppeName: g.gruppe_name,
    vereinId: g.verein_id,
    vereinName: g.verein_name,
  }));
}

export async function getTrainingsSerien(supabase: SupabaseClient, gruppenIds: string[]): Promise<TrainingsSerie[]> {
  if (gruppenIds.length === 0) return [];
  const { data } = await supabase
    .from("trainingstermine")
    .select("id, gruppe_id, ist_wiederholend, wochentag, datum, von, bis, halle, titel, gruppen(name)")
    .in("gruppe_id", gruppenIds)
    .order("ist_wiederholend", { ascending: false })
    .order("wochentag")
    .order("von");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[])
    .filter((t) => t.ist_wiederholend || (t.datum && t.datum >= heuteBerlin()))
    .map((t) => ({
      id: t.id,
      gruppeId: t.gruppe_id,
      gruppeName: t.gruppen?.name ?? "",
      wiederholend: t.ist_wiederholend,
      wochentag: t.wochentag,
      datum: t.datum,
      von: String(t.von).slice(0, 5),
      bis: String(t.bis).slice(0, 5),
      halle: t.halle,
      titel: t.titel,
    }));
}
