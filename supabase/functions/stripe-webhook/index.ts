// Stripe-Webhook (verify_jwt: false). Signatur mit STRIPE_WEBHOOK_SECRET, jedes Ereignis nur einmal.
// Uebersetzt Stripe-Ereignisse in abo_aktualisieren – die Tariflogik liegt zentral in der Datenbank.
// Ereignisse im Stripe-Dashboard: checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted, invoice.paid, invoice.payment_failed

import { JSON_KOPF, dienst, ereignisErgebnis, ereignisNeu, rechnungErstellen, stripe, stripeSignaturGueltig, stripeStatus } from "../_shared/zahlung.ts";

Deno.serve(async (req) => {
  const body = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (!(await stripeSignaturGueltig(body, req.headers.get("stripe-signature"), secret))) {
    return new Response("Ungültige Signatur", { status: 400 });
  }
  const event = JSON.parse(body);
  const admin = dienst();
  if (!(await ereignisNeu(admin, "stripe", event.id, event.type))) return new Response(JSON.stringify({ doppelt: true }), { headers: JSON_KOPF });

  const obj = event.data?.object ?? {};
  let aboId: string | null = null;
  let status: string | null = null;
  try {
    // Abo finden: ueber Metadaten (von uns gesetzt) oder die Stripe-Abo-ID
    const aboZu = async (subId: string | null, meta: string | null) => {
      if (meta) {
        const { data } = await admin.from("abos").select("*").eq("id", meta).eq("anbieter", "stripe").maybeSingle();
        if (data) return data;
      }
      if (subId) {
        const { data } = await admin.from("abos").select("*").eq("anbieter", "stripe").eq("anbieter_abo_id", subId).maybeSingle();
        if (data) return data;
      }
      return null;
    };
    // deno-lint-ignore no-explicit-any
    const anwenden = async (abo: any, sub: any, grund: string, statusErzwingen?: string) => {
      const s = stripeStatus(sub);
      status = statusErzwingen ?? s.status;
      aboId = abo.id;
      const { error } = await admin.rpc("abo_aktualisieren", {
        p_abo_id: abo.id, p_status: status, p_laeuft_bis: s.laeuftBis, p_gekuendigt_zum: s.gekuendigtZum,
        p_anbieter_abo_id: sub.id, p_anbieter_kunde_id: typeof sub.customer === "string" ? sub.customer : null, p_grund: grund,
      });
      if (error) throw new Error("abo_aktualisieren");
    };

    switch (event.type) {
      case "checkout.session.completed": {
        if (obj.mode !== "subscription" || !obj.subscription) break;
        const abo = await aboZu(null, obj.metadata?.abo_id ?? obj.client_reference_id ?? null);
        if (!abo) break;
        const sub = await stripe(`subscriptions/${obj.subscription}`);
        // aktiv nur, wenn Stripe die Zahlung bestaetigt hat
        await anwenden(abo, sub, "checkout.session.completed", obj.payment_status === "paid" ? undefined : "pending");
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const abo = await aboZu(obj.id, obj.metadata?.abo_id ?? null);
        if (abo) await anwenden(abo, obj, event.type);
        break;
      }
      case "customer.subscription.deleted": {
        const abo = await aboZu(obj.id, obj.metadata?.abo_id ?? null);
        if (abo) await anwenden(abo, obj, event.type, "expired");
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription ?? null;
        if (!subId) break;
        const sub = await stripe(`subscriptions/${subId}`);
        const abo = await aboZu(subId, sub.metadata?.abo_id ?? null);
        if (!abo) break;
        if (event.type === "invoice.paid") {
          await anwenden(abo, sub, event.type);
          if ((obj.amount_paid ?? 0) > 0) await rechnungErstellen(admin, abo, obj.amount_paid / 100, "karte/lastschrift (stripe)");
        } else {
          await anwenden(abo, sub, event.type, "past_due");
        }
        break;
      }
    }
    await ereignisErgebnis(admin, "stripe", event.id, aboId, status);
    return new Response(JSON.stringify({ received: true }), { headers: JSON_KOPF });
  } catch {
    // Ereignis wieder freigeben, damit Stripe es erneut zustellt
    await admin.from("zahlungs_ereignisse").delete().eq("anbieter", "stripe").eq("ereignis_id", event.id);
    console.error("[stripe-webhook] Verarbeitung fehlgeschlagen", event.type);
    return new Response(JSON.stringify({ error: "Verarbeitung fehlgeschlagen" }), { status: 500, headers: JSON_KOPF });
  }
});
