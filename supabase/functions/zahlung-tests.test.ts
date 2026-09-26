// Lokale Tests: npx deno test supabase/functions/zahlung-tests.test.ts
import { formDaten, paypalStatus, stripeSignaturGueltig, stripeStatus } from "./_shared/zahlung.ts";

function assert(b: boolean, m: string) {
  if (!b) throw new Error(m);
}

Deno.test("Stripe-Signatur: gueltig, falsch, zu alt", async () => {
  const secret = "whsec_test";
  const body = '{"id":"evt_1"}';
  const t = Math.floor(Date.now() / 1000);
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${body}`))), (b) => b.toString(16).padStart(2, "0")).join("");
  assert(await stripeSignaturGueltig(body, `t=${t},v1=${sig}`, secret), "gueltig");
  assert(!(await stripeSignaturGueltig(body + " ", `t=${t},v1=${sig}`, secret)), "manipulierter Body");
  assert(!(await stripeSignaturGueltig(body, `t=${t},v1=${sig}`, "whsec_andere")), "falsches Secret");
  assert(!(await stripeSignaturGueltig(body, `t=${t - 1000},v1=${sig}`, secret)), "zu alt");
  assert(!(await stripeSignaturGueltig(body, null, secret)), "ohne Kopf");
});

Deno.test("Stripe-Status", () => {
  const ende = Math.floor(Date.now() / 1000) + 3600;
  assert(stripeStatus({ status: "active", current_period_end: ende }).status === "active", "aktiv");
  const k = stripeStatus({ status: "active", cancel_at_period_end: true, items: { data: [{ current_period_end: ende }] } });
  assert(k.status === "cancelled" && k.gekuendigtZum !== null, "gekuendigt zum Laufzeitende");
  assert(stripeStatus({ status: "past_due" }).status === "past_due", "offen");
  assert(stripeStatus({ status: "incomplete" }).status === "pending", "unvollstaendig = nicht aktiv");
  assert(stripeStatus({ status: "canceled" }).status === "expired", "beendet");
});

Deno.test("PayPal-Status", () => {
  assert(paypalStatus({ status: "ACTIVE", billing_info: { next_billing_time: "2030-01-01T00:00:00Z" } }, null).laeuftBis === "2030-01-01T00:00:00Z", "naechste Zahlung");
  assert(paypalStatus({ status: "APPROVAL_PENDING" }, null).status === "pending", "nicht bestaetigt = nicht aktiv");
  const c = paypalStatus({ status: "CANCELLED" }, "2030-01-01T00:00:00Z");
  assert(c.status === "cancelled" && c.laeuftBis === "2030-01-01T00:00:00Z", "gekuendigt laeuft bis Ende");
});

Deno.test("Stripe-Formular", () => {
  const f = formDaten({ line_items: [{ price_data: { unit_amount: 299, recurring: { interval: "month" } } }], metadata: { abo_id: "x" } });
  assert(f.get("line_items[0][price_data][unit_amount]") === "299", "verschachtelt");
  assert(f.get("line_items[0][price_data][recurring][interval]") === "month", "tief");
  assert(f.get("metadata[abo_id]") === "x", "metadata");
});
