// Gemeinsame Bausteine fuer Zahlungen (Stripe + PayPal).
// Die Anbieter liefern nur Zahlungs-/Abo-Ereignisse. Die Tariflogik liegt zentral in der Datenbank
// (abo_aktualisieren, abo_pause_setzen, tarif_neu_berechnen_*); hier wird nur uebersetzt.
// Benoetigte Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
// PAYPAL_WEBHOOK_ID, PAYPAL_ENV ("live" | "sandbox"), TANZRAUM_APP_URL.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Eigenstaendig (ohne mail.ts), damit die Zahlungsfunktionen schlank bleiben
function gleich(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length || x.length === 0) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function appUrl(): string {
  return (Deno.env.get("TANZRAUM_APP_URL") ?? "https://tanzraum.app").replace(/\/+$/, "");
}

function serviceSchluessel(): string {
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (k.default) return k.default;
  } catch {
    /* Legacy */
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

export function dienst(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, serviceSchluessel(), { auth: { persistSession: false } });
}

// Nutzer-JWT pruefen; Datenbankaufrufe laufen danach ALS dieser Nutzer (RLS + auth.uid())
export async function angemeldet(req: Request): Promise<{ nutzer: SupabaseClient; userId: string; email: string | null } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(auth)) return null;
  const nutzer = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await nutzer.auth.getUser();
  if (error || !data?.user) return null;
  return { nutzer, userId: data.user.id, email: data.user.email ?? null };
}

export type AboStatus = "pending" | "active" | "trialing" | "past_due" | "cancelled" | "expired" | "paused_by_organization";

export class ZahlungsFehler extends Error {}

// ---------------- Stripe ----------------
function stripeKey(): string {
  const k = Deno.env.get("STRIPE_SECRET_KEY");
  if (!k) throw new ZahlungsFehler("Kartenzahlung ist noch nicht eingerichtet.");
  return k;
}

// Stripe erwartet form-encoded Parameter (verschachtelt mit eckigen Klammern)
export function formDaten(obj: Record<string, unknown>, prefix = "", p = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) formDaten(v as Record<string, unknown>, key, p);
    else if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? formDaten(x as Record<string, unknown>, `${key}[${i}]`, p) : p.append(`${key}[${i}]`, String(x))));
    else p.append(key, String(v));
  }
  return p;
}

// deno-lint-ignore no-explicit-any
export async function stripe(pfad: string, methode: "GET" | "POST" = "GET", daten?: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${pfad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${stripeKey()}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
    body: daten ? formDaten(daten).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("[stripe]", pfad, json?.error?.type, json?.error?.code);
    throw new ZahlungsFehler("Stripe hat die Anfrage abgelehnt.");
  }
  return json;
}

// Signatur "Stripe-Signature: t=...,v1=..." pruefen (HMAC-SHA256 ueber "t.body"), max. 5 Minuten alt
export async function stripeSignaturGueltig(body: string, kopf: string | null, secret: string, jetzt = Date.now()): Promise<boolean> {
  if (!kopf || !secret) return false;
  const teile = Object.fromEntries(kopf.split(",").map((t) => t.split("=", 2) as [string, string]).filter((t) => t.length === 2));
  const zeit = Number(teile.t);
  if (!Number.isFinite(zeit) || Math.abs(jetzt / 1000 - zeit) > 300) return false;
  const schluessel = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", schluessel, new TextEncoder().encode(`${teile.t}.${body}`)));
  const hex = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const v1 = kopf.split(",").filter((t) => t.startsWith("v1=")).map((t) => t.slice(3));
  return v1.some((s) => gleich(s, hex));
}

// deno-lint-ignore no-explicit-any
export function stripePeriodenEnde(sub: any): string | null {
  const t = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return t ? new Date(t * 1000).toISOString() : null;
}

// deno-lint-ignore no-explicit-any
export function stripeStatus(sub: any): { status: AboStatus; laeuftBis: string | null; gekuendigtZum: string | null } {
  const bis = stripePeriodenEnde(sub);
  const s: string = sub?.status ?? "";
  let status: AboStatus =
    s === "active" ? "active"
    : s === "trialing" ? "trialing"
    : s === "past_due" || s === "unpaid" || s === "paused" ? "past_due"
    : s === "canceled" || s === "incomplete_expired" ? "expired"
    : "pending";
  let gekuendigtZum: string | null = null;
  if ((status === "active" || status === "trialing") && sub?.cancel_at_period_end) {
    status = "cancelled";
    gekuendigtZum = bis;
  }
  return { status, laeuftBis: bis, gekuendigtZum };
}

// ---------------- PayPal ----------------
export function paypalBase(): string {
  return (Deno.env.get("PAYPAL_ENV") ?? "sandbox").toLowerCase() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function paypalToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new ZahlungsFehler("PayPal ist noch nicht eingerichtet.");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = await res.json();
  if (!res.ok) throw new ZahlungsFehler("PayPal-Anmeldung fehlgeschlagen.");
  return json.access_token;
}

// deno-lint-ignore no-explicit-any
export async function paypal(pfad: string, methode: "GET" | "POST" = "GET", body?: unknown, token?: string): Promise<any> {
  const t = token ?? (await paypalToken());
  const res = await fetch(`${paypalBase()}${pfad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[paypal]", pfad, json?.name, json?.details?.[0]?.issue);
    throw new ZahlungsFehler("PayPal hat die Anfrage abgelehnt.");
  }
  return json;
}

// deno-lint-ignore no-explicit-any
export function paypalStatus(sub: any, bisherBis: string | null): { status: AboStatus; laeuftBis: string | null; gekuendigtZum: string | null } {
  const next = sub?.billing_info?.next_billing_time ?? null;
  const s: string = sub?.status ?? "";
  if (s === "ACTIVE") return { status: "active", laeuftBis: next, gekuendigtZum: null };
  if (s === "SUSPENDED") return { status: "past_due", laeuftBis: next ?? bisherBis, gekuendigtZum: null };
  // PayPal beendet die Abbuchung sofort; der bezahlte Zeitraum laeuft bis zum bisherigen Ende weiter
  if (s === "CANCELLED") return { status: "cancelled", laeuftBis: bisherBis ?? new Date().toISOString(), gekuendigtZum: bisherBis ?? new Date().toISOString() };
  if (s === "EXPIRED") return { status: "expired", laeuftBis: null, gekuendigtZum: null };
  return { status: "pending", laeuftBis: null, gekuendigtZum: null };
}

// ---------------- gemeinsam ----------------
export const TARIF_NAME: Record<string, string> = { basic: "TanzRaum BASIC", verein: "TanzRaum VEREIN (Vereinslizenz)" };
export const PERIODE_NAME: Record<string, string> = { monat: "monatlich", jahr: "jährlich" };

// Ereignis nur einmal verarbeiten (Webhooks werden bei Fehlern wiederholt)
export async function ereignisNeu(admin: SupabaseClient, anbieter: string, id: string, typ: string): Promise<boolean> {
  const { error } = await admin.from("zahlungs_ereignisse").insert({ anbieter, ereignis_id: id, typ });
  return !error;
}

export async function ereignisErgebnis(admin: SupabaseClient, anbieter: string, id: string, aboId: string | null, status: string | null, fehler?: string) {
  await admin.from("zahlungs_ereignisse").update({ abo_id: aboId, status_neu: status, fehler: fehler ?? null }).eq("anbieter", anbieter).eq("ereignis_id", id);
}

// TanzRaum-Rechnung zu einer erfolgreichen Zahlung (bestehende Funktionen erstelle_rechnung / rechnung-versenden)
export async function rechnungErstellen(
  admin: SupabaseClient,
  abo: { inhaber: string; user_id: string | null; verein_id: string | null; tarif: string; periode: string },
  betragEuro: number,
  zahlungsweg: string,
) {
  try {
    const { data: id, error } = await admin.rpc("erstelle_rechnung", {
      p_typ: abo.tarif,
      p_ziel_user_id: abo.inhaber === "person" ? abo.user_id : null,
      p_ziel_verein_id: abo.inhaber === "verein" ? abo.verein_id : null,
      p_tarif: abo.tarif,
      p_periode: abo.periode,
      p_betrag: betragEuro,
      p_zahlungsweg: zahlungsweg,
    });
    if (error || !id) return console.error("[rechnung] erstellen fehlgeschlagen");
    const { error: e2 } = await admin.functions.invoke("rechnung-versenden", { body: { rechnung_id: id } });
    if (e2) console.error("[rechnung] versenden fehlgeschlagen");
  } catch {
    console.error("[rechnung] Fehler");
  }
}

export const JSON_KOPF = { "Content-Type": "application/json" };
