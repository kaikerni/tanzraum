// Supabase Edge Function: create-paypal-order
// Erstellt ein PayPal-Abo (Subscriptions API) direkt bei PayPal, ohne Stripe.
// - tarif "basic": persönliches Abo des eingeloggten Nutzers (kein vereinId nötig)
// - tarif "verein": Vereins-Abo, nur durch den Vereinsadmin, braucht vereinId
// Benötigt die Secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, optional PAYPAL_ENV ("sandbox"|"live", Default sandbox)

import { createClient } from "jsr:@supabase/supabase-js@2";

const PRICES: Record<string, Record<string, { value: string; name: string }>> = {
  basic:  { monat: { value: "2.99",  name: "TanzRaum Basic – monatlich" },  jahr: { value: "29.90", name: "TanzRaum Basic – jährlich" } },
  verein: { monat: { value: "29.90", name: "TanzRaum Verein – monatlich" }, jahr: { value: "299.00", name: "TanzRaum Verein – jährlich" } },
};
const INTERVAL: Record<string, { unit: string; count: number }> = {
  monat: { unit: "MONTH", count: 1 },
  jahr:  { unit: "YEAR",  count: 1 },
};
const APP_URL = "https://tanzraum.app";

const SCHEMA = {
  vereine:  { table: "vereine",  id: "id", subId: "paypal_subscription_id" },
  profiles: { table: "profiles", id: "id", subId: "paypal_subscription_id" },
  vereins_mitglieder: { table: "vereins_mitglieder", userId: "user_id", vereinId: "verein_id", rolleId: "rolle_id" },
  rollen: { table: "rollen", id: "id", name: "name" },
  paypal_plans: { table: "paypal_plans", key: "key", planId: "plan_id" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function paypalBase(): string {
  const env = (Deno.env.get("PAYPAL_ENV") || "sandbox").toLowerCase();
  return env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function paypalToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !secret) throw new Error("PayPal ist noch nicht eingerichtet (PAYPAL_CLIENT_ID/SECRET fehlen).");

  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${clientId}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "PayPal-Token konnte nicht erstellt werden");
  return data.access_token;
}

// deno-lint-ignore no-explicit-any
async function ensureProductId(token: string, admin: any): Promise<string> {
  const { data: row } = await admin.from(SCHEMA.paypal_plans.table).select(SCHEMA.paypal_plans.planId).eq(SCHEMA.paypal_plans.key, "product").maybeSingle();
  // deno-lint-ignore no-explicit-any
  if ((row as any)?.[SCHEMA.paypal_plans.planId]) return (row as any)[SCHEMA.paypal_plans.planId];

  const res = await fetch(`${paypalBase()}/v1/catalogs/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "TanzRaum", description: "TanzRaum Vereinsverwaltung für karnevalistischen Tanzsport", type: "SERVICE", category: "SOFTWARE" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "PayPal-Produkt konnte nicht erstellt werden");
  await admin.from(SCHEMA.paypal_plans.table).upsert({ [SCHEMA.paypal_plans.key]: "product", [SCHEMA.paypal_plans.planId]: data.id });
  return data.id;
}

// deno-lint-ignore no-explicit-any
async function ensurePlanId(token: string, admin: any, tarif: string, periode: string, productId: string): Promise<string> {
  const key = `${tarif}_${periode}`;
  const { data: row } = await admin.from(SCHEMA.paypal_plans.table).select(SCHEMA.paypal_plans.planId).eq(SCHEMA.paypal_plans.key, key).maybeSingle();
  // deno-lint-ignore no-explicit-any
  if ((row as any)?.[SCHEMA.paypal_plans.planId]) return (row as any)[SCHEMA.paypal_plans.planId];

  const price = PRICES[tarif][periode];
  const interval = INTERVAL[periode];
  const res = await fetch(`${paypalBase()}/v1/billing/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: productId,
      name: price.name,
      billing_cycles: [{
        frequency: { interval_unit: interval.unit, interval_count: interval.count },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: price.value, currency_code: "EUR" } },
      }],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 2, setup_fee_failure_action: "CONTINUE" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "PayPal-Plan konnte nicht erstellt werden");
  await admin.from(SCHEMA.paypal_plans.table).upsert({ [SCHEMA.paypal_plans.key]: key, [SCHEMA.paypal_plans.planId]: data.id });
  return data.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tarif, periode, vereinId } = await req.json();
    if (!PRICES[tarif] || !PRICES[tarif][periode]) {
      return new Response(JSON.stringify({ error: "Ungültige Anfrage (tarif/periode fehlen oder falsch)" }), { status: 400, headers: corsHeaders });
    }
    if (tarif === "verein" && !vereinId) {
      return new Response(JSON.stringify({ error: "vereinId fehlt für den Verein-Tarif" }), { status: 400, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers: corsHeaders });

    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!);
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      publishableKeys["default"],
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKeys["default"]);

    if (tarif === "verein") {
      const { data: mitglied, error: mErr } = await admin
        .from(SCHEMA.vereins_mitglieder.table)
        .select(`${SCHEMA.vereins_mitglieder.rolleId}, ${SCHEMA.rollen.table}(${SCHEMA.rollen.name})`)
        .eq(SCHEMA.vereins_mitglieder.userId, user.id)
        .eq(SCHEMA.vereins_mitglieder.vereinId, vereinId)
        .maybeSingle();
      if (mErr || !mitglied) return new Response(JSON.stringify({ error: "Keine Berechtigung für diesen Verein" }), { status: 403, headers: corsHeaders });
      // deno-lint-ignore no-explicit-any
      const rolleName = ((mitglied as any)[SCHEMA.rollen.table]?.[SCHEMA.rollen.name] || "").toLowerCase();
      if (!rolleName.includes("admin")) {
        return new Response(JSON.stringify({ error: "Nur der Vereinsadmin kann den Tarif ändern" }), { status: 403, headers: corsHeaders });
      }
    }

    const token = await paypalToken();
    const productId = await ensureProductId(token, admin);
    const planId = await ensurePlanId(token, admin, tarif, periode, productId);

    const custom_id = tarif === "verein" ? `verein:${vereinId}` : `profile:${user.id}`;

    const subRes = await fetch(`${paypalBase()}/v1/billing/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        plan_id: planId,
        custom_id,
        subscriber: { email_address: user.email },
        application_context: {
          brand_name: "TanzRaum",
          locale: "de-DE",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${APP_URL}/app.html?checkout=success`,
          cancel_url: `${APP_URL}/app.html?checkout=cancel`,
        },
      }),
    });
    const sub = await subRes.json();
    if (!subRes.ok) throw new Error(sub.message || "PayPal-Abo konnte nicht erstellt werden");

    // Abo-ID vormerken – der Tarif wird erst per Webhook aktiv geschaltet, sobald PayPal die Zahlung bestätigt
    if (tarif === "verein") {
      await admin.from(SCHEMA.vereine.table).update({ [SCHEMA.vereine.subId]: sub.id }).eq(SCHEMA.vereine.id, vereinId);
    } else {
      await admin.from(SCHEMA.profiles.table).update({ [SCHEMA.profiles.subId]: sub.id }).eq(SCHEMA.profiles.id, user.id);
    }

    // deno-lint-ignore no-explicit-any
    const approveLink = (sub.links || []).find((l: any) => l.rel === "approve")?.href;
    if (!approveLink) throw new Error("Keine PayPal-Bestätigungs-URL erhalten");

    return new Response(JSON.stringify({ url: approveLink }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[create-paypal-order]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: corsHeaders });
  }
});
