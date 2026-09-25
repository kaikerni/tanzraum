// Zahlung starten (Stripe Checkout oder PayPal-Abo). verify_jwt: true
// Body: { tarif: "basic" | "verein", periode: "monat" | "jahr", anbieter: "stripe" | "paypal", verein_id?: string }
// Die Datenbank prueft Berechtigung und Preis (abo_anlegen) und legt das Abo als "pending" an.
// Aktiv wird der Tarif AUSSCHLIESSLICH durch den Webhook des Anbieters nach erfolgreicher Zahlung.

import { JSON_KOPF, PERIODE_NAME, TARIF_NAME, UUID, ZahlungsFehler, angemeldet, appUrl, dienst, paypal, paypalToken, stripe } from "../_shared/zahlung.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const antwort = (daten: unknown, status = 200) => new Response(JSON.stringify(daten), { status, headers: { ...CORS, ...JSON_KOPF } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return antwort({ error: "Nicht erlaubt." }, 405);
  const sitzung = await angemeldet(req);
  if (!sitzung) return antwort({ error: "Bitte melde dich an." }, 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return antwort({ error: "Ungültige Anfrage." }, 400);
  }
  const { tarif, periode, anbieter } = body ?? {};
  const vereinId = body?.verein_id ?? null;
  if (!["basic", "verein"].includes(tarif) || !["monat", "jahr"].includes(periode) || !["stripe", "paypal"].includes(anbieter)) {
    return antwort({ error: "Ungültige Anfrage." }, 400);
  }
  if (vereinId !== null && !UUID.test(vereinId)) return antwort({ error: "Ungültiger Verein." }, 400);

  // Berechtigung + Preis serverseitig (als angemeldeter Nutzer)
  const { data: aboId, error } = await sitzung.nutzer.rpc("abo_anlegen", { p_tarif: tarif, p_periode: periode, p_anbieter: anbieter, p_verein_id: vereinId });
  if (error || !aboId) return antwort({ error: error?.code === "P0001" || error?.code === "42501" ? error.message : "Die Zahlung konnte nicht vorbereitet werden." }, 400);

  const admin = dienst();
  const { data: abo } = await admin.from("abos").select("id, tarif, periode, preis_cent, inhaber, verein_id").eq("id", aboId).single();
  if (!abo) return antwort({ error: "Die Zahlung konnte nicht vorbereitet werden." }, 500);
  const email = sitzung.email ?? undefined;
  const zurueck = `${appUrl()}/dashboard/tarif`;
  const titel = `${TARIF_NAME[abo.tarif]} – ${PERIODE_NAME[abo.periode]}`;

  try {
    if (anbieter === "stripe") {
      const session = await stripe("checkout/sessions", "POST", {
        mode: "subscription",
        client_reference_id: abo.id,
        customer_email: email,
        locale: "de",
        metadata: { abo_id: abo.id },
        subscription_data: { metadata: { abo_id: abo.id } },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: abo.preis_cent,
              recurring: { interval: abo.periode === "jahr" ? "year" : "month" },
              product_data: { name: titel },
            },
          },
        ],
        success_url: `${zurueck}?zahlung=erfolg`,
        cancel_url: `${zurueck}?zahlung=abgebrochen`,
      });
      return antwort({ url: session.url });
    }

    // PayPal: Plan je Tarif/Zeitraum/Preis (zwischengespeichert in paypal_plans)
    const token = await paypalToken();
    let { data: produkt } = await admin.from("paypal_plans").select("plan_id").eq("key", "product").maybeSingle();
    if (!produkt?.plan_id) {
      const p = await paypal("/v1/catalogs/products", "POST", { name: "TanzRaum", type: "SERVICE", category: "SOFTWARE" }, token);
      await admin.from("paypal_plans").upsert({ key: "product", plan_id: p.id });
      produkt = { plan_id: p.id };
    }
    const planKey = `${abo.tarif}_${abo.periode}_${abo.preis_cent}`;
    let { data: plan } = await admin.from("paypal_plans").select("plan_id").eq("key", planKey).maybeSingle();
    if (!plan?.plan_id) {
      const p = await paypal(
        "/v1/billing/plans",
        "POST",
        {
          product_id: produkt.plan_id,
          name: titel,
          billing_cycles: [
            {
              frequency: { interval_unit: abo.periode === "jahr" ? "YEAR" : "MONTH", interval_count: 1 },
              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: { fixed_price: { value: (abo.preis_cent / 100).toFixed(2), currency_code: "EUR" } },
            },
          ],
          payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 2 },
        },
        token,
      );
      await admin.from("paypal_plans").upsert({ key: planKey, plan_id: p.id });
      plan = { plan_id: p.id };
    }
    const sub = await paypal(
      "/v1/billing/subscriptions",
      "POST",
      {
        plan_id: plan.plan_id,
        custom_id: `abo:${abo.id}`,
        subscriber: email ? { email_address: email } : undefined,
        application_context: {
          brand_name: "TanzRaum",
          locale: "de-DE",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${zurueck}?zahlung=erfolg`,
          cancel_url: `${zurueck}?zahlung=abgebrochen`,
        },
      },
      token,
    );
    await admin.rpc("abo_aktualisieren", {
      p_abo_id: abo.id, p_status: null, p_laeuft_bis: null, p_gekuendigt_zum: null,
      p_anbieter_abo_id: sub.id, p_anbieter_kunde_id: null, p_grund: "paypal_erstellt",
    });
    // deno-lint-ignore no-explicit-any
    const link = (sub.links ?? []).find((l: any) => l.rel === "approve")?.href;
    if (!link) throw new ZahlungsFehler("PayPal hat keinen Bestätigungslink geliefert.");
    return antwort({ url: link });
  } catch (e) {
    await admin.from("abos").delete().eq("id", abo.id).eq("status", "pending");
    return antwort({ error: e instanceof ZahlungsFehler ? e.message : "Die Zahlung konnte gerade nicht gestartet werden. Bitte versuche es später erneut." }, 502);
  }
});
