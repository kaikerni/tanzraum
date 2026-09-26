import type { SupabaseClient } from "@supabase/supabase-js";

export type GruppenZuordnung = { id: string; name: string; funktion: "mitglied" | "trainer" | "betreuer" | null };
export type Person = { vmId: string; name: string };

export type Mitglied = {
  vmId: string;
  userId: string;
  name: string;
  handle: string | null;
  email: string | null;
  rolleId: string | null;
  rolle: string | null;
  aktiv: boolean;
  altersklasse: string | null;
  seit: string;
  bereiche: string[] | null;
  gruppen: GruppenZuordnung[];
  eltern: Person[];
  kinder: Person[];
  istIch: boolean;
  geschlecht: string | null;
};

export async function getMitgliederListe(supabase: SupabaseClient, vereinId: string): Promise<Mitglied[] | null> {
  const { data, error } = await supabase.rpc("mitglieder_liste", { p_verein_id: vereinId });
  if (error) return null;
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((m) => ({
    vmId: m.vm_id,
    userId: m.user_id,
    name: m.name,
    handle: m.handle,
    email: m.email,
    rolleId: m.rolle_id,
    rolle: m.rolle,
    aktiv: m.aktiv,
    altersklasse: m.altersklasse,
    seit: m.seit,
    bereiche: m.bereiche,
    gruppen: m.gruppen ?? [],
    // deno-lint-ignore no-explicit-any
    eltern: (m.eltern ?? []).map((p: any) => ({ vmId: p.vm_id, name: p.name })),
    // deno-lint-ignore no-explicit-any
    kinder: (m.kinder ?? []).map((p: any) => ({ vmId: p.vm_id, name: p.name })),
    istIch: m.ist_ich,
    geschlecht: m.geschlecht ?? null,
  }));
}

export async function getMitgliederAuswahl(supabase: SupabaseClient, vereinId: string): Promise<Person[]> {
  const { data, error } = await supabase.rpc("mitglieder_auswahl", { p_verein_id: vereinId });
  if (error || !data) return [];
  return (data as { vm_id: string; name: string }[]).map((p) => ({ vmId: p.vm_id, name: p.name }));
}

// Vereine, in denen der Nutzer die Mitgliederliste oeffnen darf (Vereinsadmin oder Bereich "mitglieder").
export async function getMitgliederVereine(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.rpc("meine_bereiche");
  return new Set(
    ((data ?? []) as { verein_id: string | null; bereich: string }[])
      .filter((b) => b.verein_id && (b.bereich === "mitglieder" || b.bereich === "rolle_admin"))
      .map((b) => b.verein_id as string),
  );
}
