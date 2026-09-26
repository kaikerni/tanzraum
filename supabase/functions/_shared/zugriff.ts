// Gemeinsame Zugriffspruefung und Versandprotokoll fuer die TanzRaum-Mail-Funktionen.
//
// - angemeldet(): prueft das Nutzer-JWT; Datenbankaufrufe laufen danach ALS dieser Nutzer (RLS + auth.uid()).
// - dienst(): Service-Client, nur fuer Protokoll/Ratenbegrenzung und fest definierte Lesezugriffe.
// - Protokolliert werden nur Metadaten (Art, Absender-Konto, Verein, Bezug, Anzahl) – keine Adressen, keine Inhalte.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { serviceSchluessel } from "./mail.ts";

export async function angemeldet(req: Request): Promise<{ nutzer: SupabaseClient; userId: string } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) return null;
  const nutzer = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await nutzer.auth.getUser();
  if (error || !data?.user) return null;
  return { nutzer, userId: data.user.id };
}

export function dienst(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, serviceSchluessel(), { auth: { persistSession: false } });
}

export async function protokollieren(
  admin: SupabaseClient,
  e: { art: string; absender_user?: string | null; verein_id?: string | null; bezug_id?: string | null; empfaenger_anzahl?: number; erfolgreich: boolean },
) {
  await admin.from("mail_versand_log").insert({ empfaenger_anzahl: 1, ...e });
}

// Anzahl erfolgreicher Versandvorgaenge in den letzten `stunden` Stunden (fuer Ratenbegrenzung)
export async function versandSeit(
  admin: SupabaseClient,
  filter: { art: string; absender_user?: string; verein_id?: string; bezug_id?: string },
  stunden: number,
): Promise<number> {
  let q = admin
    .from("mail_versand_log")
    .select("id", { count: "exact", head: true })
    .eq("art", filter.art)
    .eq("erfolgreich", true)
    .gte("erstellt_am", new Date(Date.now() - stunden * 3600_000).toISOString());
  if (filter.absender_user) q = q.eq("absender_user", filter.absender_user);
  if (filter.verein_id) q = q.eq("verein_id", filter.verein_id);
  if (filter.bezug_id) q = q.eq("bezug_id", filter.bezug_id);
  const { count, error } = await q;
  // Im Zweifel blockieren statt unbegrenzt senden
  return error ? Number.MAX_SAFE_INTEGER : (count ?? 0);
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
