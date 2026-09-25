// Supabase Edge Function: cancel-paypal-subscription
// Kuendigt das persoenliche PayPal-Basic-Abo eines Nutzers, wenn er einem
// zahlenden VEREIN als Mitglied hinzugefuegt wird (Verein zahlt dann fuer ihn mit).
// Nur der Vereinsadmin des jeweiligen Vereins darf das ausloesen.

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
    const { targetProfileId, vereinId } = await req.json();
    if (!targetProfileId || !vereinId) {
      return new Response(JSON.stringify({ error: "targetProfileId/vereinId fehlen" }), { status: 400, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers: corsHeaders });

    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!);
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publishableKeys["default"], { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Nicht angemeldet" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKeys["default"]);

    // NEU: Verein muss tatsaechlich die Verein-Lizenz bezahlt haben — sonst darf hier
    // niemandes persoenliches Abo gekuendigt werden. Das war vorher serverseitig gar
    // nicht geprueft (nur clientseitig, und dort fehlerhaft ueber state.tarif).
    const { data: verein } = await admin
      .from("vereine")
      .select("tarif")
      .eq("id", vereinId)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    if (!verein || (verein as any).tarif !== "verein") {
      return new Response(
        JSON.stringify({ cancelled: false, reason: "Dieser Verein hat keine Verein-Lizenz — persoenliches Abo bleibt unangetastet." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Aufrufer muss Admin genau dieses Vereins sein
    const { data: callerMitglied } = await admin
      .from("vereins_mitglieder")
      .select("rolle_id, rollen(name)")
      .eq("user_id", user.id)
      .eq("verein_id", vereinId)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const callerRolle = ((callerMitglied as any)?.rollen?.name || "").toLowerCase();
    if (!callerMitglied || !callerRolle.includes("admin")) {
      return new Response(JSON.stringify({ error: "Nur der Vereinsadmin darf das ausloesen" }), { status: 403, headers: corsHeaders });
    }

    // Zielnutzer muss tatsaechlich Mitglied dieses Vereins sein
    const { data: zielMitglied } = await admin
      .from("vereins_mitglieder")
      .select("id")
      .eq("user_id", targetProfileId)
      .eq("verein_id", vereinId)
      .maybeSingle();
    if (!zielMitglied) {
      return new Response(JSON.stringify({ error: "Zielnutzer ist kein Mitglied dieses Vereins" }), { status: 400, headers: corsHeaders });
    }

    const { data: zielProfil } = await admin
      .from("profiles")
      .select("tarif, paypal_subscription_id")
      .eq("id", targetProfileId)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const profil = zielProfil as any;
    if (!profil || profil.tarif !== "basic" || !profil.paypal_subscription_id) {
      return new Response(JSON.stringify({ cancelled: false, reason: "Kein aktives persoenliches Basic-Abo gefunden" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = await paypalToken();
    const cancelRes = await fetch(`${paypalBase()}/v1/billing/subscriptions/${profil.paypal_subscription_id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Mitglied ist einem zahlenden Verein beigetreten – Verein uebernimmt den Tarif" }),
    });
    // PayPal liefert bei Erfolg 204 No Content
    if (!cancelRes.ok && cancelRes.status !== 204) {
      const errBody = await cancelRes.text();
      throw new Error("PayPal-Kuendigung fehlgeschlagen: " + errBody);
    }

    // Optimistisch schon jetzt zuruecksetzen – der Webhook bestaetigt es gleich nochmal
    await admin.from("profiles").update({ tarif: "free", paypal_subscription_id: null }).eq("id", targetProfileId);

    return new Response(JSON.stringify({ cancelled: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cancel-paypal-subscription]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: corsHeaders });
  }
});
