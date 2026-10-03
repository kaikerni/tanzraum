"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { freundlicherFehler } from "@/lib/fehler";
import type { AktionsErgebnis } from "@/components/ui/SendenButton";
import { ALLE_RECHTE } from "@/lib/team/rechte";

// Nur TanzRaum-Admin – die Datenbank prueft das Recht (admin_* Funktionen) und protokolliert jede Aenderung.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export type PersonTreffer = { userId: string; name: string; handle: string | null; avatarUrl: string | null; email: string | null; tarif: string; team: boolean; verein: string | null };

export async function personenSuchen(q: string): Promise<PersonTreffer[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_personen_suche", { p_q: q.slice(0, 100) });
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((p) => ({
    userId: p.user_id,
    name: p.name,
    handle: p.handle,
    avatarUrl: p.avatar_url,
    email: p.email_maskiert,
    tarif: p.tarif,
    team: p.team === true,
    verein: p.verein,
  }));
}

export async function teamSpeichern(eingabe: {
  userId: string;
  moderator: boolean;
  kennzeichnen: boolean;
  alleRechte: boolean;
  rechte: string[];
  basic: boolean;
  basicBis: string | null;
  notiz: string;
}): Promise<AktionsErgebnis> {
  if (!UUID.test(eingabe.userId)) return { error: "Ungültige Person." };
  if (eingabe.basicBis && !DATUM.test(eingabe.basicBis)) return { error: "Bitte ein gültiges Datum angeben." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_team_setzen", {
    p_user_id: eingabe.userId,
    p_moderator: eingabe.moderator,
    p_kennzeichnen: eingabe.kennzeichnen,
    p_alle_rechte: eingabe.alleRechte,
    p_rechte: eingabe.rechte.filter((r) => ALLE_RECHTE.includes(r)),
    p_basic: eingabe.basic,
    p_basic_bis: eingabe.basic ? eingabe.basicBis : null,
    p_notiz: eingabe.notiz.slice(0, 500),
  });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/admin/team");
  revalidatePath("/dashboard/admin/lizenzen");
  return { error: null, ok: "Gespeichert." };
}

export async function teamEntfernen(userId: string, basicBehalten: boolean): Promise<AktionsErgebnis> {
  if (!UUID.test(userId)) return { error: "Ungültige Person." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_team_entfernen", { p_user_id: userId, p_basic_behalten: basicBehalten });
  if (error) return { error: freundlicherFehler(error) };
  revalidatePath("/dashboard/admin/team");
  revalidatePath("/dashboard/admin/lizenzen");
  return { error: null, ok: basicBehalten ? "Aus dem Team entfernt – das kostenlose BASIC bleibt bestehen." : "Aus dem Team entfernt." };
}
