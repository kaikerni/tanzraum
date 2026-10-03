import type { SupabaseClient } from "@supabase/supabase-js";
import type { JuryKontext } from "./getJuryContext";

type TurnierTag = { datum: string; wochentag: string };
type ZusageStatus = "offen" | "zugesagt" | "abgesagt";

type TurnierRow = {
  id: string;
  name: string;
  ort: string | null;
  typ: string | null;
  kategorie: string | null;
  tage: TurnierTag[] | null;
  verband_id: string | null;
};

export type JuryEinsatz = {
  turnierId: string;
  turnierName: string;
  ort: string | null;
  erstesDatum: string | null;
  funktionen: string[];
  zusageStatus: ZusageStatus | null;
};

export type JuryEinladung = {
  zusageId: string;
  turnierId: string;
  turnierName: string;
  ort: string | null;
  erstesDatum: string | null;
};

export type JuryTurnierUebersicht = {
  turnierId: string;
  turnierName: string;
  ort: string | null;
  erstesDatum: string | null;
  eigeneVerfuegbarkeit: "kann" | "kann_nicht" | "vielleicht" | null;
};

export type JuryDashboardDaten = {
  offeneEinladungen: JuryEinladung[];
  naechsteEinsaetze: JuryEinsatz[];
  bevorstehendeTurniere: JuryTurnierUebersicht[];
};

function erstesDatum(tage: TurnierTag[] | null): string | null {
  if (!tage || tage.length === 0) return null;
  return [...tage].sort((a, b) => a.datum.localeCompare(b.datum))[0].datum;
}

function sichtbarFuerVerband(turnier: TurnierRow, kontext: JuryKontext): boolean {
  if (kontext.rolle === "admin") return true;
  if (turnier.verband_id === null) return true;
  return turnier.verband_id === kontext.verbandId;
}

export async function getJuryDashboardData(
  supabase: SupabaseClient,
  kontext: JuryKontext,
  userId: string,
): Promise<JuryDashboardDaten> {
  const heute = new Date().toISOString().slice(0, 10);

  const { data: turniere } = await supabase
    .from("turniere")
    .select("id, name, ort, typ, kategorie, tage, verband_id")
    .returns<TurnierRow[]>();

  const sichtbareTurniere = (turniere ?? [])
    .filter((t) => sichtbarFuerVerband(t, kontext))
    .map((t) => ({ ...t, erstesDatum: erstesDatum(t.tage) }))
    .filter((t) => t.erstesDatum !== null && t.erstesDatum >= heute)
    .sort((a, b) => (a.erstesDatum ?? "").localeCompare(b.erstesDatum ?? ""));

  const turnierById = new Map(sichtbareTurniere.map((t) => [t.id, t]));

  const { data: zusagen } = await supabase
    .from("juryraum_einsatz_zusagen")
    .select("id, turnier_id, status")
    .eq("user_id", userId);

  const zusageByTurnier = new Map(
    (zusagen ?? []).map((z) => [z.turnier_id, { id: z.id, status: z.status as ZusageStatus }]),
  );

  const offeneEinladungen: JuryEinladung[] = (zusagen ?? [])
    .filter((z) => z.status === "offen")
    .map((z) => {
      const turnier = turnierById.get(z.turnier_id);
      if (!turnier) return null;
      return {
        zusageId: z.id,
        turnierId: turnier.id,
        turnierName: turnier.name,
        ort: turnier.ort,
        erstesDatum: turnier.erstesDatum,
      };
    })
    .filter((e): e is JuryEinladung => e !== null);

  const { data: besetzungen } = await supabase
    .from("juryraum_besetzungen")
    .select("turnier_id, obmann_user_ids, wertende_user_ids, passkontrolle_user_ids")
    .or(
      `obmann_user_ids.cs.{${userId}},wertende_user_ids.cs.{${userId}},passkontrolle_user_ids.cs.{${userId}}`,
    );

  const naechsteEinsaetze: JuryEinsatz[] = (besetzungen ?? [])
    .map((b) => {
      const turnier = turnierById.get(b.turnier_id);
      if (!turnier) return null;
      const funktionen: string[] = [];
      if ((b.obmann_user_ids ?? []).includes(userId)) funktionen.push("Obmann/Obfrau");
      if ((b.wertende_user_ids ?? []).includes(userId)) funktionen.push("Wertung");
      if ((b.passkontrolle_user_ids ?? []).includes(userId)) funktionen.push("Passkontrolle");
      return {
        turnierId: turnier.id,
        turnierName: turnier.name,
        ort: turnier.ort,
        erstesDatum: turnier.erstesDatum,
        funktionen,
        zusageStatus: zusageByTurnier.get(b.turnier_id)?.status ?? null,
      };
    })
    .filter((e): e is JuryEinsatz => e !== null)
    .sort((a, b) => (a.erstesDatum ?? "").localeCompare(b.erstesDatum ?? ""));

  const { data: verfuegbarkeiten } = await supabase
    .from("juryraum_verfuegbarkeiten")
    .select("turnier_id, status")
    .eq("user_id", userId);

  const verfuegbarkeitByTurnier = new Map(
    (verfuegbarkeiten ?? []).map((v) => [v.turnier_id, v.status as "kann" | "kann_nicht" | "vielleicht"]),
  );

  const bevorstehendeTurniere: JuryTurnierUebersicht[] = sichtbareTurniere
    .slice(0, 10)
    .map((t) => ({
      turnierId: t.id,
      turnierName: t.name,
      ort: t.ort,
      erstesDatum: t.erstesDatum,
      eigeneVerfuegbarkeit: verfuegbarkeitByTurnier.get(t.id) ?? null,
    }));

  return { offeneEinladungen, naechsteEinsaetze, bevorstehendeTurniere };
}

/** Alle sichtbaren, bevorstehenden Turniere mit eigener Verfuegbarkeit -- fuer die
 * Verfuegbarkeiten-Seite (ungekuerzte Liste, anders als das Dashboard-Digest). */
export async function getJuryVerfuegbarkeiten(
  supabase: SupabaseClient,
  kontext: JuryKontext,
  userId: string,
): Promise<JuryTurnierUebersicht[]> {
  const heute = new Date().toISOString().slice(0, 10);

  const { data: turniere } = await supabase
    .from("turniere")
    .select("id, name, ort, typ, kategorie, tage, verband_id")
    .returns<TurnierRow[]>();

  const sichtbareTurniere = (turniere ?? [])
    .filter((t) => sichtbarFuerVerband(t, kontext))
    .map((t) => ({ ...t, erstesDatum: erstesDatum(t.tage) }))
    .filter((t) => t.erstesDatum !== null && t.erstesDatum >= heute)
    .sort((a, b) => (a.erstesDatum ?? "").localeCompare(b.erstesDatum ?? ""));

  const { data: verfuegbarkeiten } = await supabase
    .from("juryraum_verfuegbarkeiten")
    .select("turnier_id, status")
    .eq("user_id", userId);

  const verfuegbarkeitByTurnier = new Map(
    (verfuegbarkeiten ?? []).map((v) => [v.turnier_id, v.status as "kann" | "kann_nicht" | "vielleicht"]),
  );

  return sichtbareTurniere.map((t) => ({
    turnierId: t.id,
    turnierName: t.name,
    ort: t.ort,
    erstesDatum: t.erstesDatum,
    eigeneVerfuegbarkeit: verfuegbarkeitByTurnier.get(t.id) ?? null,
  }));
}
