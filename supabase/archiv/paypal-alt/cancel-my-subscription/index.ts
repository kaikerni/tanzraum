// Supabase Edge Function: cancel-my-subscription
// Echte Selbstkuendigung des eigenen persoenlichen Basic-Abos (PayPal). Der Nutzer kuendigt
// sich selbst -- die Ziel-ID kommt aus dem eigenen Login-Token, nicht aus dem Request-Body.

import { createClient } from "jsr:@supabase/supabase-js@2";

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
  if (!clientId || !secret) throw new Error("PayPal ist noch nicht eingerichtet.");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${clientId}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "PayPal-Token fehlgeschlagen");
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers: corsHeaders });

    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!);
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publishableKeys["default"], { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKeys["default"]);

    const { data: profil } = await admin.from("profiles").select("tarif, paypal_subscription_id").eq("id", user.id).maybeSingle();
    // deno-lint-ignore no-explicit-any
    const p = profil as any;

    if (!p || p.tarif !== "basic") {
      return new Response(JSON.stringify({ cancelled: false, reason: "Kein aktives Basic-Abo gefunden." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!p.paypal_subscription_id) {
      // Kein PayPal-Abo hinterlegt (z.B. per Ueberweisung bezahlt) -- keine automatische
      // Kuendigung ueber eine API moeglich, ehrliche Antwort statt Vortaeuschen.
      return new Response(JSON.stringify({
        cancelled: false,
        reason: "manual",
        message: "Dein Tarif läuft nicht über PayPal (z. B. Überweisung). Bitte schreib uns an info@tanzraum.app, wir kündigen das für dich.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = await paypalToken();
    const cancelRes = await fetch(`${paypalBase()}/v1/billing/subscriptions/${p.paypal_subscription_id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Nutzer hat sein Abo selbst gekuendigt" }),
    });
    if (!cancelRes.ok && cancelRes.status !== 204) {
      const errBody = await cancelRes.text();
      throw new Error("PayPal-Kündigung fehlgeschlagen: " + errBody);
    }

    // Optimistisch schon jetzt zuruecksetzen -- der Webhook bestaetigt es gleich nochmal
    await admin.from("profiles").update({ tarif: "free", paypal_subscription_id: null }).eq("id", user.id);

    return new Response(JSON.stringify({ cancelled: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cancel-my-subscription]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: corsHeaders });
  }
});
