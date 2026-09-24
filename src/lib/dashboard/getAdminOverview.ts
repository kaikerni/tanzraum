import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardKpis = {
  mitgliederGesamt: number;
  vereineGesamt: number;
  turniereKommende30Tage: number;
  trainingsbeteiligungProzent: number | null;
  trainingsbeteiligungVormonatProzent: number | null;
};

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

export type AltersklassenVerteilung = { altersklasse: string; anzahl: number };

export async function getDashboardKpis(supabase: SupabaseClient): Promise<DashboardKpis | null> {
  const { data: raw, error } = await supabase.rpc("admin_dashboard_kpis").maybeSingle();
  if (error || !raw) return null;
  // deno-lint-ignore no-explicit-any
  const data = raw as any;
  return {
    mitgliederGesamt: Number(data.mitglieder_gesamt ?? 0),
    vereineGesamt: Number(data.vereine_gesamt ?? 0),
    turniereKommende30Tage: Number(data.turniere_kommende_30_tage ?? 0),
    trainingsbeteiligungProzent:
      data.trainingsbeteiligung_prozent === null ? null : Number(data.trainingsbeteiligung_prozent),
    trainingsbeteiligungVormonatProzent:
      data.trainingsbeteiligung_vormonat_prozent === null
        ? null
        : Number(data.trainingsbeteiligung_vormonat_prozent),
  };
}

export async function getNaechsteTermine(supabase: SupabaseClient, anzahl = 8): Promise<Termin[]> {
  const { data, error } = await supabase.rpc("admin_naechste_termine", { p_anzahl: anzahl });
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

export async function getMitgliederNachAltersklasse(
  supabase: SupabaseClient,
): Promise<AltersklassenVerteilung[]> {
  const { data, error } = await supabase.rpc("admin_mitglieder_nach_altersklasse");
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((r) => ({ altersklasse: r.altersklasse, anzahl: Number(r.anzahl) }));
}
