import type { SupabaseClient } from "@supabase/supabase-js";

export type Tarif = "free" | "basic" | "verein" | string;

export type VereinsMitgliedschaft = {
  vereinId: string;
  vereinName: string;
  vereinTarif: Tarif | null;
  vereinGesperrt: boolean;
  rolleName: string | null;
  istAdmin: boolean;
};

export type DashboardDaten = {
  userId: string;
  vorname: string | null;
  nachname: string | null;
  handle: string | null;
  avatarUrl: string | null;
  gesperrt: boolean;
  istPlattformAdmin: boolean;
  persoenlicherTarif: Tarif;
  tarifAktivBis: string | null;
  vereine: VereinsMitgliedschaft[];
  istJuryMitglied: boolean;
};

/**
 * Buendelt alles, was das Dashboard fuer den eingeloggten Nutzer braucht:
 * eigenes Profil (Tarif/Rolle/Admin-Flag) + Vereinsmitgliedschaften mit Rolle je Verein.
 */
export async function getDashboardData(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardDaten | null> {
  const { data: profil, error: profilError } = await supabase
    .from("profiles")
    .select(
      "id, vorname, nachname, handle, avatar_url, gesperrt, ist_plattform_admin",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profilError || !profil) return null;

  // Tarif/Laufzeit sind fuer andere nicht lesbar (Spaltenrechte) -> eigene Werte per RPC.
  const { data: privat } = await supabase.rpc("mein_profil_privat").maybeSingle();
  // deno-lint-ignore no-explicit-any
  const eigen = (privat ?? {}) as any;

  const { data: mitgliedschaften } = await supabase
    .from("vereins_mitglieder")
    .select("verein_id, vereine(id, name, tarif, gesperrt), rollen(name)")
    .eq("user_id", userId);

  const vereine: VereinsMitgliedschaft[] = (mitgliedschaften ?? []).map(
    // deno-lint-ignore no-explicit-any
    (m: any) => {
      const rolleName: string | null = m.rollen?.name ?? null;
      return {
        vereinId: m.verein_id,
        vereinName: m.vereine?.name ?? "",
        vereinTarif: m.vereine?.tarif ?? null,
        vereinGesperrt: m.vereine?.gesperrt ?? false,
        rolleName,
        istAdmin: (rolleName ?? "").toLowerCase().includes("admin"),
      };
    },
  );

  const { data: juryMitgliedschaft } = await supabase
    .from("juryraum_mitglieder")
    .select("id")
    .eq("user_id", userId)
    .eq("aktiv", true)
    .maybeSingle();

  return {
    userId: profil.id,
    vorname: profil.vorname,
    nachname: profil.nachname,
    handle: profil.handle,
    avatarUrl: profil.avatar_url,
    gesperrt: profil.gesperrt,
    istPlattformAdmin: profil.ist_plattform_admin,
    persoenlicherTarif: eigen.tarif ?? "free",
    tarifAktivBis: eigen.tarif_aktiv_bis ?? null,
    vereine,
    istJuryMitglied: juryMitgliedschaft !== null,
  };
}
