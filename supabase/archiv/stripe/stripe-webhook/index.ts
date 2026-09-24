// Supabase Edge Function: stripe-webhook
// Empfängt Stripe-Events und aktualisiert den Tarif-Status:
// - tarif "basic" → profiles-Zeile des Nutzers
// - tarif "verein" → vereine-Zeile des Vereins
// WICHTIG: Für diese Funktion muss "Enforce JWT Verification" AUS sein,
// da Stripe keinen Supabase-Login-Token mitschickt.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SCHEMA = {
  vereine: {
    table: "vereine", id: "id", tarif: "tarif",
    stripeCustomerId: "stripe_customer_id",
    stripeSubscriptionId: "stripe_subscription_id",
    tarifAktivBis: "tarif_aktiv_bis",
  },
  profiles: {
    table: "profiles", id: "id", tarif: "tarif",
    stripeCustomerId: "stripe_customer_id",
    stripeSubscriptionId: "stripe_subscription_id",
    tarifAktivBis: "tarif_aktiv_bis",
  },
};

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  const signedPayload = `${parts.t}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === parts.v1;
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  const valid = await verifyStripeSignature(payload, sig, webhookSecret).catch(() => false);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(payload);
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKeys["default"]);

  // Ermittelt anhand der Stripe-Subscription, ob es sich um ein Verein- oder Basic-Abo handelt
  async function findeTarifZiel(subscriptionId: string): Promise<{ table: string; idCol: string; idVal: string } | null> {
    const { data: verein } = await admin.from(SCHEMA.vereine.table)
      .select(SCHEMA.vereine.id).eq(SCHEMA.vereine.stripeSubscriptionId, subscriptionId).maybeSingle();
    if (verein) return { table: SCHEMA.vereine.table, idCol: SCHEMA.vereine.id, idVal: (verein as Record<string, string>)[SCHEMA.vereine.id] };

    const { data: profile } = await admin.from(SCHEMA.profiles.table)
      .select(SCHEMA.profiles.id).eq(SCHEMA.profiles.stripeSubscriptionId, subscriptionId).maybeSingle();
    if (profile) return { table: SCHEMA.profiles.table, idCol: SCHEMA.profiles.id, idVal: (profile as Record<string, string>)[SCHEMA.profiles.id] };

    return null;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const tarif = session.metadata?.tarif;
      const vereinId = session.metadata?.verein_id;
      const profileId = session.metadata?.profile_id;

      if (tarif === "verein" && vereinId) {
        await admin.from(SCHEMA.vereine.table).update({
          [SCHEMA.vereine.tarif]: tarif,
          [SCHEMA.vereine.stripeCustomerId]: session.customer,
          [SCHEMA.vereine.stripeSubscriptionId]: session.subscription,
        }).eq(SCHEMA.vereine.id, vereinId);
      } else if (tarif === "basic" && profileId) {
        await admin.from(SCHEMA.profiles.table).upsert({
          [SCHEMA.profiles.id]: profileId,
          [SCHEMA.profiles.tarif]: tarif,
          [SCHEMA.profiles.stripeCustomerId]: session.customer,
          [SCHEMA.profiles.stripeSubscriptionId]: session.subscription,
        }, { onConflict: SCHEMA.profiles.id });
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const ziel = await findeTarifZiel(sub.id);
      if (ziel) {
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        const felder: Record<string, unknown> = {
          [ziel.table === SCHEMA.vereine.table ? SCHEMA.vereine.tarifAktivBis : SCHEMA.profiles.tarifAktivBis]: periodEnd,
        };
        if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          felder[ziel.table === SCHEMA.vereine.table ? SCHEMA.vereine.tarif : SCHEMA.profiles.tarif] = "free";
        }
        await admin.from(ziel.table).update(felder).eq(ziel.idCol, ziel.idVal);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const ziel = await findeTarifZiel(sub.id);
      if (ziel) {
        const tarifCol = ziel.table === SCHEMA.vereine.table ? SCHEMA.vereine.tarif : SCHEMA.profiles.tarif;
        const subCol = ziel.table === SCHEMA.vereine.table ? SCHEMA.vereine.stripeSubscriptionId : SCHEMA.profiles.stripeSubscriptionId;
        await admin.from(ziel.table).update({ [tarifCol]: "free", [subCol]: null }).eq(ziel.idCol, ziel.idVal);
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[stripe-webhook]", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500 });
  }
});
