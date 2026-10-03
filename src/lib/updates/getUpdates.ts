import type { SupabaseClient } from "@supabase/supabase-js";
import { ankuendigungBildUrl, type Ankuendigung } from "@/lib/news/getNews";

// Updates & Neuigkeiten = TanzRaum-Ankuendigungen der Art „neuheit“ (Tabelle plattform_ankuendigungen).
// Gepflegt von der TanzRaum-Administration unter /dashboard/admin/updates.

export const UPDATE_KATEGORIEN = [
  { wert: "neue_funktion", label: "Neue Funktion" },
  { wert: "verbesserung", label: "Verbesserung" },
  { wert: "fehlerbehebung", label: "Fehlerbehebung" },
  { wert: "hinweis", label: "Hinweis" },
] as const;

export function kategorieLabel(k: string | null | undefined): string {
  return UPDATE_KATEGORIEN.find((x) => x.wert === k)?.label ?? "Neuigkeit";
}

export type TanzraumUpdate = {
  id: string;
  version: string | null;
  titel: string;
  kurztext: string | null;
  text: string;
  kategorie: string | null;
  datum: string;
  bildUrl: string | null;
  linkUrl: string | null;
  linkText: string | null;
};

// Interne Ziele (/dashboard/...) und https-Links; alles andere wird nicht verlinkt
export function sichererLink(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^\/(?!\/)[^\s]*$/.test(url) || /^https:\/\/\S+$/.test(url)) return url;
  return null;
}

// Oeffentliche Neuheiten fuer Landingpage und /neu (auch ohne Anmeldung)
export async function getOeffentlicheUpdates(supabase: SupabaseClient, limit = 3): Promise<TanzraumUpdate[]> {
  const { data, error } = await supabase.rpc("tanzraum_neuigkeiten_oeffentlich", { p_limit: limit });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((u) => ({
    id: u.id,
    version: u.version,
    titel: u.titel,
    kurztext: u.kurztext,
    text: u.text ?? "",
    kategorie: u.kategorie,
    datum: u.datum,
    bildUrl: ankuendigungBildUrl(u.bild_pfad),
    linkUrl: sichererLink(u.link_url),
    linkText: u.link_text,
  }));
}

// Neuheiten aus den eigenen Ankuendigungen (eingeloggter Bereich)
export function nurUpdates(liste: Ankuendigung[]): Ankuendigung[] {
  return liste.filter((a) => a.art === "neuheit").sort((a, b) => b.sichtbarAb.localeCompare(a.sichtbarAb));
}

export function datumKurz(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}
