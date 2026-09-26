import type { SupabaseClient } from "@supabase/supabase-js";

export type StartStatus = "geplant" | "gemeldet" | "abgesagt";
export type StartRueckmeldung = "dabei" | "nicht_dabei" | "unsicher";

export const STATUS_LABEL: Record<StartStatus, string> = { geplant: "Geplant", gemeldet: "Gemeldet", abgesagt: "Abgesagt" };
export const RUECKMELDUNG_LABEL: Record<StartRueckmeldung, string> = { dabei: "Dabei", unsicher: "Unsicher", nicht_dabei: "Nicht dabei" };

export type TurnierTag = { datum: string; wochentag: string | null; beginn?: string | null };

export type Turnier = {
  id: string;
  name: string;
  typ: string | null;
  kategorie: string | null;
  ort: string;
  adresse: string | null;
  ausrichter: string | null;
  ausschreibungUrl: string | null;
  verband: string | null;
  ersterTag: string;
  letzterTag: string;
  tage: TurnierTag[];
  meldeschluss: string | null;
  beginnSamstag: string | null;
  beginnSonntag: string | null;
  vereinId: string | null;
  vereinName: string | null;
  gemerkt: boolean;
  unsereStarts: number;
};

export type Start = {
  id: string;
  turnierId: string;
  turnierName: string;
  turnierOrt: string;
  ersterTag: string;
  letzterTag: string;
  turnierTage: TurnierTag[];
  meldeschluss: string | null;
  eigenesTurnier: boolean;
  gruppeId: string | null;
  gruppeName: string | null;
  bezeichnung: string | null;
  solisten: string[];
  solistenNamen: string | null;
  disziplinId: string | null;
  disziplin: string | null;
  altersklasseId: string | null;
  altersklasse: string | null;
  tag: string | null;
  startnummer: string | null;
  status: StartStatus;
  notiz: string | null;
  platz: number | null;
  punkte: number | null;
  ergebnisNotiz: string | null;
  dabei: number;
  nichtDabei: number;
  unsicher: number;
  teilnehmer: number;
  darfBearbeiten: boolean;
};

export type MeinStart = {
  startId: string;
  turnierId: string;
  turnierName: string;
  turnierOrt: string;
  ersterTag: string;
  letzterTag: string;
  tag: string | null;
  vereinName: string;
  teilnahme: string;
  disziplin: string | null;
  altersklasse: string | null;
  status: StartStatus;
  vmId: string;
  person: string;
  ich: boolean;
  rueckmeldung: StartRueckmeldung | null;
};

export type StartTeilnehmer = { vmId: string; name: string; status: StartRueckmeldung | null; kommentar: string | null };

// deno-lint-ignore no-explicit-any
function alsTurnier(t: any): Turnier {
  return {
    id: t.id,
    name: t.name,
    typ: t.typ,
    kategorie: t.kategorie,
    ort: t.ort,
    adresse: t.adresse,
    ausrichter: t.ausrichter && t.ausrichter !== "—" ? t.ausrichter : null,
    ausschreibungUrl: t.ausschreibung_url,
    verband: t.verband,
    ersterTag: t.erster_tag,
    letzterTag: t.letzter_tag,
    tage: (t.tage ?? []) as TurnierTag[],
    meldeschluss: t.meldeschluss,
    beginnSamstag: t.beginn_samstag,
    beginnSonntag: t.beginn_sonntag,
    vereinId: t.verein_id,
    vereinName: t.verein_name,
    gemerkt: !!t.gemerkt,
    unsereStarts: t.unsere_starts ?? 0,
  };
}

export async function getTurniere(supabase: SupabaseClient, von: string, bis: string): Promise<Turnier[]> {
  const { data, error } = await supabase.rpc("turniere_uebersicht", { p_von: von, p_bis: bis });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map(alsTurnier);
}

// Einzelnes Turnier (auch vergangene). Sichtbarkeit (Katalog oder eigener Verein) prueft RLS.
export async function getTurnier(supabase: SupabaseClient, id: string): Promise<Turnier | null> {
  const [{ data: t }, { data: merk }, { count }] = await Promise.all([
    supabase.from("turniere").select("*, verbaende(kuerzel, name), vereine(name)").eq("id", id).maybeSingle(),
    supabase.from("turnier_merkliste").select("turnier_id").eq("turnier_id", id).maybeSingle(),
    supabase.from("turnier_starts").select("id", { count: "exact", head: true }).eq("turnier_id", id).neq("status", "abgesagt"),
  ]);
  if (!t) return null;
  const daten = ((t.tage ?? []) as TurnierTag[]).map((d) => d.datum).sort();
  return alsTurnier({
    ...t,
    verband: t.verbaende?.kuerzel ?? t.verbaende?.name ?? null,
    verein_name: t.vereine?.name ?? null,
    erster_tag: daten[0],
    letzter_tag: daten[daten.length - 1],
    gemerkt: !!merk,
    unsere_starts: count ?? 0,
  });
}

export async function getVereinsStarts(
  supabase: SupabaseClient,
  vereinId: string,
  von: string,
  bis: string,
  turnierId?: string,
): Promise<Start[]> {
  const { data, error } = await supabase.rpc("vereins_starts", {
    p_verein_id: vereinId,
    p_von: von,
    p_bis: bis,
    p_turnier_id: turnierId ?? null,
  });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((s) => ({
    id: s.id,
    turnierId: s.turnier_id,
    turnierName: s.turnier_name,
    turnierOrt: s.turnier_ort,
    ersterTag: s.erster_tag,
    letzterTag: s.letzter_tag,
    turnierTage: (s.turnier_tage ?? []) as TurnierTag[],
    meldeschluss: s.meldeschluss,
    eigenesTurnier: !!s.eigenes_turnier,
    gruppeId: s.gruppe_id,
    gruppeName: s.gruppe_name,
    bezeichnung: s.bezeichnung,
    solisten: s.solisten ?? [],
    solistenNamen: s.solisten_namen,
    disziplinId: s.disziplin_id,
    disziplin: s.disziplin,
    altersklasseId: s.altersklasse_id,
    altersklasse: s.altersklasse,
    tag: s.tag,
    startnummer: s.startnummer,
    status: s.status,
    notiz: s.notiz,
    platz: s.platz,
    punkte: s.punkte === null ? null : Number(s.punkte),
    ergebnisNotiz: s.ergebnis_notiz,
    dabei: s.dabei,
    nichtDabei: s.nicht_dabei,
    unsicher: s.unsicher,
    teilnehmer: s.teilnehmer,
    darfBearbeiten: !!s.darf_bearbeiten,
  }));
}

export async function getMeineStarts(supabase: SupabaseClient, ab: string): Promise<MeinStart[]> {
  const { data, error } = await supabase.rpc("meine_turnierstarts", { p_ab: ab });
  if (error || !data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((s) => ({
    startId: s.start_id,
    turnierId: s.turnier_id,
    turnierName: s.turnier_name,
    turnierOrt: s.turnier_ort,
    ersterTag: s.erster_tag,
    letzterTag: s.letzter_tag,
    tag: s.tag,
    vereinName: s.verein_name,
    teilnahme: s.teilnahme,
    disziplin: s.disziplin,
    altersklasse: s.altersklasse,
    status: s.status,
    vmId: s.vm_id,
    person: s.person ?? "Mitglied",
    ich: !!s.ich,
    rueckmeldung: s.rueckmeldung,
  }));
}

export async function getStartTeilnehmer(supabase: SupabaseClient, startId: string): Promise<StartTeilnehmer[]> {
  const { data } = await supabase.rpc("turnier_start_teilnehmer", { p_start_id: startId });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((t) => ({ vmId: t.vm_id, name: t.name ?? "Mitglied", status: t.status, kommentar: t.kommentar }));
}

// ---------------------------------------------------------------------------------------------
// Vereine, fuer die man planen darf (Bereich "saison" oder Vereinsadmin, mit Lizenz) + Auswahllisten
// ---------------------------------------------------------------------------------------------
export type PlanungsVerein = {
  vereinId: string;
  vereinName: string;
  gruppen: { id: string; name: string }[];
  mitglieder: { vmId: string; name: string }[];
};

export type Stammdaten = { disziplinen: { id: string; name: string }[]; altersklassen: { id: string; name: string }[] };

export async function getPlanungsVereine(supabase: SupabaseClient): Promise<PlanungsVerein[]> {
  const { data: bereiche } = await supabase.rpc("meine_bereiche");
  const ids = [
    ...new Set(
      // deno-lint-ignore no-explicit-any
      ((bereiche ?? []) as any[]).filter((b) => b.bereich === "saison" || b.bereich === "rolle_admin").map((b) => b.verein_id as string),
    ),
  ];
  if (ids.length === 0) return [];
  const [{ data: vereine }, { data: gruppen }, { data: vms }] = await Promise.all([
    supabase.from("vereine").select("id, name").in("id", ids).order("name"),
    supabase.from("gruppen").select("id, name, verein_id").in("verein_id", ids).order("name"),
    supabase.from("vereins_mitglieder").select("id, user_id, verein_id").in("verein_id", ids),
  ]);
  const userIds = [...new Set((vms ?? []).map((v) => v.user_id))];
  const { data: namen } = userIds.length ? await supabase.rpc("anzeige_namen", { p_user_ids: userIds }) : { data: [] };
  // deno-lint-ignore no-explicit-any
  const nameVon = new Map(((namen ?? []) as any[]).map((n) => [n.user_id as string, n.anzeige as string]));
  return (vereine ?? []).map((v) => ({
    vereinId: v.id,
    vereinName: v.name,
    gruppen: (gruppen ?? []).filter((g) => g.verein_id === v.id).map((g) => ({ id: g.id, name: g.name ?? "Gruppe" })),
    mitglieder: (vms ?? [])
      .filter((m) => m.verein_id === v.id)
      .map((m) => ({ vmId: m.id, name: nameVon.get(m.user_id) ?? "Mitglied" }))
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  }));
}

export async function getStammdaten(supabase: SupabaseClient): Promise<Stammdaten> {
  const [{ data: d }, { data: a }] = await Promise.all([
    supabase.from("disziplinen").select("id, name").order("sortierung"),
    supabase.from("altersklassen").select("id, name").order("sortierung"),
  ]);
  return { disziplinen: d ?? [], altersklassen: a ?? [] };
}

// ---------------------------------------------------------------------------------------------
// Saison: 1. August bis 31. Juli (z. B. "2026/27")
// ---------------------------------------------------------------------------------------------
export function saisonVon(datum: string): number {
  const [j, m] = datum.split("-").map(Number);
  return m >= 8 ? j : j - 1;
}

export function saison(startjahr: number) {
  return {
    startjahr,
    label: `${startjahr}/${String((startjahr + 1) % 100).padStart(2, "0")}`,
    von: `${startjahr}-08-01`,
    bis: `${startjahr + 1}-07-31`,
  };
}

// ---------------------------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------------------------
const TAG_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function datumAus(iso: string) {
  const [j, m, t] = iso.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t));
}

export function datumKurz(iso: string): string {
  const d = datumAus(iso);
  return `${TAG_KURZ[d.getUTCDay()]}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

export function datumLang(iso: string): string {
  return datumAus(iso).toLocaleDateString("de-DE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function zeitraum(von: string, bis: string): string {
  if (von === bis) return datumAus(von).toLocaleDateString("de-DE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long", year: "numeric" });
  const a = datumAus(von);
  const b = datumAus(bis);
  const gleicherMonat = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  return gleicherMonat
    ? `${a.getUTCDate()}.–${b.toLocaleDateString("de-DE", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}`
    : `${a.toLocaleDateString("de-DE", { timeZone: "UTC", day: "numeric", month: "short" })} – ${b.toLocaleDateString("de-DE", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })}`;
}

export function monatsLabel(iso: string): string {
  return datumAus(iso).toLocaleDateString("de-DE", { timeZone: "UTC", month: "long", year: "numeric" });
}

export function tageBis(iso: string, heute: string): number {
  return Math.round((datumAus(iso).getTime() - datumAus(heute).getTime()) / 86400000);
}

export function startTitel(s: Pick<Start, "gruppeName" | "bezeichnung" | "solistenNamen">): string {
  return s.gruppeName ?? s.bezeichnung ?? s.solistenNamen ?? "Start";
}
