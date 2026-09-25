// PayPal-Webhook (verify_jwt: false). Signaturpruefung ueber PayPal (PAYPAL_WEBHOOK_ID), jedes Ereignis nur einmal.
// Uebersetzt PayPal-Ereignisse in abo_aktualisieren – die Tariflogik liegt zentral in der Datenbank.
// Ereignisse: BILLING.SUBSCRIPTION.ACTIVATED/UPDATED/CANCELLED/SUSPENDED/EXPIRED/PAYMENT.FAILED, PAYMENT.SALE.COMPLETED

import { JSON_KOPF, dienst, ereignisErgebnis, ereignisNeu, paypal, paypalStatus, paypalToken, rechnungErstellen } from "../_shared/zahlung.ts";

async function signaturGueltig(token: string, h: Headers, body: string): Promise<boolean> {
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
  if (!webhookId) return false;
  try {
    const r = await paypal("/v1/notifications/verify-webhook-signature", "POST", {
      auth_algo: h.get("paypal-auth-algo"),
      cert_url: h.get("paypal-cert-url"),
      transmission_id: h.get("paypal-transmission-id"),
      transmission_sig: h.get("paypal-transmission-sig"),
      transmission_time: h.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }, token);
    return r.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const body = await req.text();
  let token: string;
  try {
    token = await paypalToken();
  } catch {
    return new Response("PayPal nicht eingerichtet", { status: 503 });
  }
  if (!(await signaturGueltig(token, req.headers, body))) return new Response("Ungültige Signatur", { status: 400 });

  const event = JSON.parse(body);
  const admin = dienst();
  if (!(await ereignisNeu(admin, "paypal", event.id, event.event_type))) return new Response(JSON.stringify({ doppelt: true }), { headers: JSON_KOPF });

  const r = event.resource ?? {};
  let aboId: string | null = null;
  let status: string | null = null;
  try {
    const subId: string | null = event.event_type.startsWith("BILLING.SUBSCRIPTION.") ? r.id : (r.billing_agreement_id ?? null);
    if (subId) {
      const customAbo = typeof r.custom_id === "string" && r.custom_id.startsWith("abo:") ? r.custom_id.slice(4) : null;
      let { data: abo } = await admin.from("abos").select("*").eq("anbieter", "paypal").eq("anbieter_abo_id", subId).maybeSingle();
      if (!abo && customAbo) ({ data: abo } = await admin.from("abos").select("*").eq("id", customAbo).eq("anbieter", "paypal").maybeSingle());
      if (abo) {
        aboId = abo.id;
        // Aktuellen Stand immer direkt bei PayPal abfragen (nicht dem Ereignis allein vertrauen)
        const sub = await paypal(`/v1/billing/subscriptions/${subId}`, "GET", undefined, token);
        const s = paypalStatus(sub, abo.laeuft_bis);
        status = event.event_type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" ? "past_due" : s.status;
        const { error } = await admin.rpc("abo_aktualisieren", {
          p_abo_id: abo.id, p_status: status, p_laeuft_bis: s.laeuftBis, p_gekuendigt_zum: s.gekuendigtZum,
          p_anbieter_abo_id: subId, p_anbieter_kunde_id: sub?.subscriber?.payer_id ?? null, p_grund: event.event_type,
        });
        if (error) throw new Error("abo_aktualisieren");
        if (event.event_type === "PAYMENT.SALE.COMPLETED") {
          const betrag = Number(r.amount?.total ?? r.amount?.value ?? 0);
          if (betrag > 0) await rechnungErstellen(admin, abo, betrag, "paypal");
        }
      }
    }
    await ereignisErgebnis(admin, "paypal", event.id, aboId, status);
    return new Response(JSON.stringify({ received: true }), { headers: JSON_KOPF });
  } catch {
    await admin.from("zahlungs_ereignisse").delete().eq("anbieter", "paypal").eq("ereignis_id", event.id);
    console.error("[paypal-webhook] Verarbeitung fehlgeschlagen", event.event_type);
    return new Response(JSON.stringify({ error: "Verarbeitung fehlgeschlagen" }), { status: 500, headers: JSON_KOPF });
  }
});
