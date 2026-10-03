import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { SpotlightPerson } from "./typen";
import type { Ich } from "@/components/spotlights/SpotlightLeiste";

// Schalter der TanzRaum-Administration (an/aus + freigegebene Tarife), geprueft in der Datenbank
export async function spotlightsFuerMich(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("spotlights_fuer_mich");
  return data === true;
}

export async function getSpotlightLeiste(supabase: SupabaseClient): Promise<SpotlightPerson[]> {
  const [{ data }, { data: vorschau }] = await Promise.all([supabase.rpc("spotlight_leiste"), supabase.rpc("spotlight_vorschaubilder")]);
  // Vorschaubild der Story-Kachel: neuestes Foto (signierter Link, privater Bucket) bzw. Text-Hintergrund
  // deno-lint-ignore no-explicit-any
  const vor = new Map(((vorschau ?? []) as any[]).map((v) => [v.user_id as string, v]));
  const pfade = [...vor.values()].map((v) => v.media_path).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (pfade.length > 0) {
    const { data: signiert } = await supabase.storage.from("spotlights").createSignedUrls(pfade, 60 * 60);
    for (const x of signiert ?? []) if (x.path && x.signedUrl) urls.set(x.path, x.signedUrl);
  }
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((p) => {
    const v = vor.get(p.user_id);
    return {
      userId: p.user_id,
      name: p.name,
      avatarUrl: p.avatar_url,
      anzahl: p.anzahl,
      ungesehen: p.ungesehen,
      neuestes: p.neuestes,
      ich: p.ich,
      vorschauUrl: v?.media_path ? (urls.get(v.media_path) ?? null) : null,
      vorschauHintergrund: v?.media_typ === "text" ? v.hintergrund : null,
    };
  });
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
    // Kinderkonten unter 16: nur Verein & Kontakte, bis ein verknuepftes Elternteil das aendert (Datenbank prueft)
    standardSichtbarkeit: s?.spotlights_nur_kontakte ? "kontakte" : "netzwerk",
    nurKontakte: !!s?.spotlights_nur_kontakte,
  };
}
