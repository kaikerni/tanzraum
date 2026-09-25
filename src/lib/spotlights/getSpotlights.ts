import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { SpotlightPerson } from "./typen";
import type { Ich } from "@/components/spotlights/SpotlightLeiste";

export async function getSpotlightLeiste(supabase: SupabaseClient): Promise<SpotlightPerson[]> {
  const { data } = await supabase.rpc("spotlight_leiste");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((p) => ({
    userId: p.user_id,
    name: p.name,
    avatarUrl: p.avatar_url,
    anzahl: p.anzahl,
    ungesehen: p.ungesehen,
    neuestes: p.neuestes,
    ich: p.ich,
  }));
}

// Angaben fuer "+ Spotlight": Name/Bild der Person selbst, Tarif, Jugendschutz-Voreinstellung
export async function getSpotlightIch(supabase: SupabaseClient, user: User): Promise<Ich> {
  const [{ data: profil }, { data: tarif }, { data: schutz }] = await Promise.all([
    supabase.from("profiles").select("vorname, nachname, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.rpc("mein_tarif"),
    supabase.rpc("meine_kind_einstellungen"),
  ]);
  // deno-lint-ignore no-explicit-any
  const s = ((schutz ?? []) as any[])[0];
  return {
    userId: user.id,
    name: [profil?.vorname, profil?.nachname].filter(Boolean).join(" ") || "Du",
    avatarUrl: profil?.avatar_url ?? null,
    darfErstellen: tarif === "basic" || tarif === "verein",
    // Jugendschutz betrifft nur Nachrichten – Spotlights fuer alle gleich (Eltern koennen "nur Kontakte" festlegen)
    standardSichtbarkeit: "netzwerk",
    nurKontakte: !!(s?.hat_eltern && s?.spotlights_nur_kontakte),
  };
}
