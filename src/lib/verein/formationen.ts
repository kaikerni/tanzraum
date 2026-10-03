import type { SupabaseClient } from "@supabase/supabase-js";

// Formation = konkrete Besetzung einer Disziplin (z. B. Tanzpaar, Solist weiblich, Schautanz mit Thema).
// Getrennt von Vereinsgruppen (organisatorisch) und Disziplinen (sportliche Zuordnung).
export type Disziplin = { id: string; name: string; besetzung: "solo" | "paar" | "gruppe"; mitThema: boolean };
export type FormationsMitglied = { vmId: string; name: string; auftrittsname: string | null };
export type Formation = {
  id: string;
  name: string;
  disziplinId: string;
  disziplin: string;
  besetzung: Disziplin["besetzung"];
  altersklasseId: string | null;
  altersklasse: string | null;
  gruppeId: string | null;
  gruppe: string | null;
  thema: string | null;
  aktiv: boolean;
  mitglieder: FormationsMitglied[];
  bdkHinweis: string | null;
};

export async function getDisziplinen(supabase: SupabaseClient): Promise<{ disziplinen: Disziplin[]; erlaubt: Map<string, Set<string>> }> {
  const [{ data: d }, { data: ad }] = await Promise.all([
    supabase.from("disziplinen").select("id, name, besetzung, mit_thema").order("sortierung"),
    supabase.from("altersklasse_disziplinen").select("altersklasse_id, disziplin_id"),
  ]);
  const erlaubt = new Map<string, Set<string>>();
  for (const z of ad ?? []) erlaubt.set(z.altersklasse_id, new Set([...(erlaubt.get(z.altersklasse_id) ?? []), z.disziplin_id]));
  return {
    disziplinen: (d ?? []).map((x) => ({ id: x.id, name: x.name, besetzung: x.besetzung, mitThema: x.mit_thema })),
    erlaubt,
  };
}

export async function getFormationen(supabase: SupabaseClient, vereinId: string, namen: Map<string, string>): Promise<Formation[]> {
  const { data } = await supabase
    .from("formationen")
    .select(
      "id, name, disziplin_id, altersklasse_id, gruppe_id, thema, aktiv, disziplinen(name, besetzung), altersklassen(name), gruppen(name), formation_mitglieder(vereins_mitglied_id, auftrittsname)",
    )
    .eq("verein_id", vereinId)
    .order("name");
  // deno-lint-ignore no-explicit-any
  const liste = ((data ?? []) as any[]).map(
    (f): Formation => ({
      id: f.id,
      name: f.name,
      disziplinId: f.disziplin_id,
      disziplin: f.disziplinen?.name ?? "–",
      besetzung: f.disziplinen?.besetzung ?? "gruppe",
      altersklasseId: f.altersklasse_id,
      altersklasse: f.altersklassen?.name ?? null,
      gruppeId: f.gruppe_id,
      gruppe: f.gruppen?.name ?? null,
      thema: f.thema,
      aktiv: f.aktiv,
      // deno-lint-ignore no-explicit-any
      mitglieder: (f.formation_mitglieder ?? []).map((m: any) => ({
        vmId: m.vereins_mitglied_id,
        name: namen.get(m.vereins_mitglied_id) ?? "Mitglied",
        auftrittsname: m.auftrittsname,
      })),
      bdkHinweis: null,
    }),
  );
  // BDK-Hinweis nur fuer Tanzpaare (die Datenbank schraenkt die Besetzung nicht nach Geschlecht ein)
  await Promise.all(
    liste
      .filter((f) => f.besetzung === "paar")
      .map(async (f) => {
        const { data: h } = await supabase.rpc("formation_bdk_hinweis", { p_formation: f.id });
        f.bdkHinweis = (h as string | null) ?? null;
      }),
  );
  return liste;
}
