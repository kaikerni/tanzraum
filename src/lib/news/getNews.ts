import type { SupabaseClient } from "@supabase/supabase-js";

// Zielgruppen wie in der Datenbank (ziele_pruefen / ziel_empfaenger)
export type Ziel =
  | { art: "verein" }
  | { art: "gruppe"; id: string }
  | { art: "eltern_gruppe"; id: string }
  | { art: "rolle"; rolle: "admin" | "trainer" | "betreuer" | "mitglied" | "eltern" };

export const ROLLEN_LABEL: Record<string, string> = {
  admin: "Vereinsadmins",
  trainer: "Trainer/innen",
  betreuer: "Betreuer/innen",
  mitglied: "Tänzer/innen",
  eltern: "Eltern",
};

export type News = {
  id: string;
  vereinId: string;
  vereinName: string;
  titel: string;
  text: string;
  wichtig: boolean;
  erstelltAm: string;
  geaendertAm: string | null;
  autor: string | null;
  gelesenAm: string | null;
  istEmpfaenger: boolean;
  darfVerwalten: boolean;
  empfaenger: number | null;
  gelesen: number | null;
  ziele: Ziel[] | null;
};

export type Umfrage = {
  id: string;
  vereinId: string;
  vereinName: string;
  frage: string;
  beschreibung: string | null;
  optionen: string[];
  mehrfach: boolean;
  anonym: boolean;
  endetAm: string;
  erstelltAm: string;
  autor: string | null;
  istEmpfaenger: boolean;
  darfVerwalten: boolean;
  empfaenger: number;
  teilnehmer: number;
  stimmen: number[];
  meine: number[];
  namen: string[][] | null;
};

export type Ankuendigung = {
  id: string;
  titel: string;
  text: string;
  art: "info" | "wartung" | "neuheit";
  wichtig: boolean;
  sichtbarAb: string;
  sichtbarBis: string | null;
  gelesenAm: string | null;
  bildUrl: string | null;
  linkUrl: string | null;
  linkText: string | null;
};

// Bilder der TanzRaum-Ankuendigungen liegen im oeffentlichen Bucket "ankuendigungen"
export function ankuendigungBildUrl(pfad: string | null | undefined): string | null {
  if (!pfad) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ankuendigungen/${pfad.split("/").map(encodeURIComponent).join("/")}`;
}

export type WichtigeNews = { id: string; vereinName: string; titel: string; text: string; erstelltAm: string; autor: string | null };

// Vereine, in denen die Person News/Umfragen verfassen darf (inkl. erlaubter Gruppen)
export type VerfasserVerein = {
  vereinId: string;
  vereinName: string;
  istAdmin: boolean;
  newsRollen: string[];
  gruppen: { id: string; name: string }[];
};

export async function getMeineNews(supabase: SupabaseClient, limit = 50): Promise<News[]> {
  const { data } = await supabase.rpc("meine_news", { p_limit: limit });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((n) => ({
    id: n.id,
    vereinId: n.verein_id,
    vereinName: n.verein_name,
    titel: n.titel,
    text: n.text,
    wichtig: n.wichtig,
    erstelltAm: n.erstellt_am,
    geaendertAm: n.geaendert_am,
    autor: n.autor,
    gelesenAm: n.gelesen_am,
    istEmpfaenger: n.ist_empfaenger,
    darfVerwalten: n.darf_verwalten,
    empfaenger: n.empfaenger,
    gelesen: n.gelesen,
    ziele: n.ziele,
  }));
}

export async function getMeineUmfragen(supabase: SupabaseClient, limit = 50): Promise<Umfrage[]> {
  const { data } = await supabase.rpc("meine_vereinsumfragen", { p_limit: limit });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((u) => ({
    id: u.id,
    vereinId: u.verein_id,
    vereinName: u.verein_name,
    frage: u.frage,
    beschreibung: u.beschreibung,
    optionen: u.optionen ?? [],
    mehrfach: u.mehrfach,
    anonym: u.anonym,
    endetAm: u.endet_am,
    erstelltAm: u.erstellt_am,
    autor: u.autor,
    istEmpfaenger: u.ist_empfaenger,
    darfVerwalten: u.darf_verwalten,
    empfaenger: u.empfaenger,
    teilnehmer: u.teilnehmer,
    stimmen: u.stimmen ?? [],
    meine: u.meine ?? [],
    namen: u.namen,
  }));
}

export async function getAnkuendigungen(supabase: SupabaseClient): Promise<Ankuendigung[]> {
  const { data } = await supabase.rpc("meine_ankuendigungen");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((a) => ({
    id: a.id,
    titel: a.titel,
    text: a.text,
    art: a.art,
    wichtig: a.wichtig,
    sichtbarAb: a.sichtbar_ab,
    sichtbarBis: a.sichtbar_bis,
    gelesenAm: a.gelesen_am,
    bildUrl: ankuendigungBildUrl(a.bild_pfad),
    linkUrl: a.link_url,
    linkText: a.link_text,
  }));
}

export async function getOffeneWichtigeNews(supabase: SupabaseClient): Promise<WichtigeNews[]> {
  const { data } = await supabase.rpc("meine_offenen_wichtigen_news");
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((n) => ({
    id: n.id,
    vereinName: n.verein_name,
    titel: n.titel,
    text: n.text,
    erstelltAm: n.erstellt_am,
    autor: n.autor,
  }));
}

export async function getVerfasserVereine(supabase: SupabaseClient, userId: string): Promise<VerfasserVerein[]> {
  const { data: vms } = await supabase.from("vereins_mitglieder").select("verein_id, vereine(id, name, news_rollen)").eq("user_id", userId);
  // deno-lint-ignore no-explicit-any
  const vereine = ((vms ?? []) as any[]).map((v) => v.vereine).filter(Boolean) as { id: string; name: string; news_rollen: string[] }[];
  const eindeutig = [...new Map(vereine.map((v) => [v.id, v])).values()];
  const ergebnis = await Promise.all(
    eindeutig.map(async (v) => {
      const [{ data: darf }, { data: eigene }, { data: gruppen }] = await Promise.all([
        supabase.rpc("darf_news_verfassen", { p_verein: v.id }),
        supabase.rpc("news_eigene_gruppen", { p_verein: v.id }),
        supabase.from("gruppen").select("id, name").eq("verein_id", v.id).order("name"),
      ]);
      if (darf !== true) return null;
      const alle = (gruppen ?? []) as { id: string; name: string }[];
      const erlaubt = eigene === null ? alle : alle.filter((g) => (eigene as string[]).includes(g.id));
      return { vereinId: v.id, vereinName: v.name, istAdmin: eigene === null, newsRollen: v.news_rollen ?? [], gruppen: erlaubt };
    }),
  );
  return ergebnis.filter((v): v is VerfasserVerein => v !== null);
}

export function zieleText(ziele: Ziel[] | null, gruppen: Map<string, string>): string {
  if (!ziele?.length) return "";
  return ziele
    .map((z) =>
      z.art === "verein"
        ? "ganzer Verein"
        : z.art === "gruppe"
          ? (gruppen.get(z.id) ?? "Gruppe")
          : z.art === "eltern_gruppe"
            ? `Eltern ${gruppen.get(z.id) ?? "einer Gruppe"}`
            : (ROLLEN_LABEL[z.rolle] ?? z.rolle),
    )
    .join(", ");
}
