// Supabase Edge Function: create-checkout-session
// Erstellt eine Stripe Checkout Session (SEPA-Lastschrift, PayPal, bei Jahresabo zusätzlich Klarna).
// - tarif "basic": persönliches Abo des eingeloggten Nutzers (kein vereinId nötig)
// - tarif "verein": Vereins-Abo, nur durch den Vereinsadmin, braucht vereinId

import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Konfiguration an einer Stelle ──
const PRICE_IDS: Record<string, Record<string, string>> = {
  basic:  { monat: "price_1UEFcUBjmtBRN8hDUJ8EmQ3C", jahr: "price_1UEFhhBjmtBRN8hDLT25sXVG" },
  verein: { monat: "price_1UEFnYBjmtBRN8hDRZqhghjU", jahr: "price_1UEFoEBjmtBRN8hD3GbkFiXj" },
};
const APP_URL = "https://tanzraum.app";

const SCHEMA = {
  vereine: { table: "vereine", id: "id", stripeCustomerId: "stripe_customer_id" },
  profiles: { table: "profiles", id: "id", stripeCustomerId: "stripe_customer_id" },
  vereins_mitglieder: { table: "vereins_mitglieder", profileId: "profile_id", vereinId: "verein_id", rolleId: "rolle_id" },
  rollen: { table: "rollen", id: "id", name: "name" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tarif, periode, vereinId } = await req.json();
    if (!PRICE_IDS[tarif] || !["monat", "jahr"].includes(periode)) {
      return new Response(JSON.stringify({ error: "Ungültige Anfrage (tarif/periode fehlen oder falsch)" }), { status: 400, headers: corsHeaders });
    }
    if (tarif === "verein" && !vereinId) {
      return new Response(JSON.stringify({ error: "vereinId fehlt für den Verein-Tarif" }), { status: 400, headers: corsHeaders });
    }
    const priceId = PRICE_IDS[tarif][periode];

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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    // deno-lint-ignore no-explicit-any
    let customerId: any = null;
    const metadata: Record<string, string> = { tarif, periode };

    if (tarif === "verein") {
      const { data: mitglied, error: mErr } = await admin
        .from(SCHEMA.vereins_mitglieder.table)
        .select(`${SCHEMA.vereins_mitglieder.rolleId}, ${SCHEMA.rollen.table}(${SCHEMA.rollen.name})`)
        .eq(SCHEMA.vereins_mitglieder.profileId, user.id)
        .eq(SCHEMA.vereins_mitglieder.vereinId, vereinId)
        .maybeSingle();
      if (mErr || !mitglied) return new Response(JSON.stringify({ error: "Keine Berechtigung für diesen Verein" }), { status: 403, headers: corsHeaders });
      // deno-lint-ignore no-explicit-any
      const rolleName = ((mitglied as any)[SCHEMA.rollen.table]?.[SCHEMA.rollen.name] || "").toLowerCase();
      if (!rolleName.includes("admin")) {
        return new Response(JSON.stringify({ error: "Nur der Vereinsadmin kann den Tarif ändern" }), { status: 403, headers: corsHeaders });
      }
      metadata.verein_id = vereinId;

      const { data: verein } = await admin
        .from(SCHEMA.vereine.table)
        .select(`${SCHEMA.vereine.id}, ${SCHEMA.vereine.stripeCustomerId}`)
        .eq(SCHEMA.vereine.id, vereinId)
        .maybeSingle();
      // deno-lint-ignore no-explicit-any
      customerId = (verein as any)?.[SCHEMA.vereine.stripeCustomerId] || null;
    } else {
      metadata.profile_id = user.id;

      const { data: profile } = await admin
        .from(SCHEMA.profiles.table)
        .select(`${SCHEMA.profiles.id}, ${SCHEMA.profiles.stripeCustomerId}`)
        .eq(SCHEMA.profiles.id, user.id)
        .maybeSingle();
      // deno-lint-ignore no-explicit-any
      customerId = (profile as any)?.[SCHEMA.profiles.stripeCustomerId] || null;
    }

    if (!customerId) {
      const custRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: user.email || "", ...(tarif === "verein" ? { "metadata[verein_id]": vereinId } : { "metadata[profile_id]": user.id }) }),
      });
      const cust = await custRes.json();
      if (!custRes.ok) throw new Error(cust.error?.message || "Stripe-Kunde konnte nicht erstellt werden");
      customerId = cust.id;

      if (tarif === "verein") {
        await admin.from(SCHEMA.vereine.table).update({ [SCHEMA.vereine.stripeCustomerId]: customerId }).eq(SCHEMA.vereine.id, vereinId);
      } else {
        await admin.from(SCHEMA.profiles.table).upsert({ [SCHEMA.profiles.id]: user.id, [SCHEMA.profiles.stripeCustomerId]: customerId }, { onConflict: SCHEMA.profiles.id });
      }
    }

    const params = new URLSearchParams({
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${APP_URL}/app.html?checkout=success`,
      cancel_url: `${APP_URL}/app.html?checkout=cancel`,
    });
    Object.entries(metadata).forEach(([k, v]) => params.append(`metadata[${k}]`, v));

    // Zahlungsmethoden: SEPA + PayPal immer, Klarna nur beim Jahresabo (Basic & Verein)
    const paymentMethods = periode === "jahr"
      ? ["sepa_debit", "paypal", "klarna"]
      : ["sepa_debit", "paypal"];
    paymentMethods.forEach((m, i) => params.append(`payment_method_types[${i}]`, m));

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const session = await sessionRes.json();
    if (!sessionRes.ok) throw new Error(session.error?.message || "Checkout-Session konnte nicht erstellt werden");

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: corsHeaders });
  }
});
