// Abo kuendigen (verify_jwt: true). Body: { abo_id, aktion: "kuendigen" }
// Gekuendigt wird zum Ende des bezahlten Zeitraums; bis dahin bleibt der Tarif aktiv.

import { JSON_KOPF, UUID, ZahlungsFehler, angemeldet, dienst, paypal, stripe, stripeStatus } from "../_shared/zahlung.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const antwort = (daten: unknown, status = 200) => new Response(JSON.stringify(daten), { status, headers: { ...CORS, ...JSON_KOPF } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sitzung = await angemeldet(req);
  if (!sitzung) return antwort({ error: "Bitte melde dich an." }, 401);
  const { abo_id, aktion } = await req.json().catch(() => ({}));
  if (!UUID.test(String(abo_id ?? "")) || aktion !== "kuendigen") return antwort({ error: "Ungültige Anfrage." }, 400);

  const { data: darf } = await sitzung.nutzer.rpc("abo_darf_verwalten", { p_abo_id: abo_id });
  if (darf !== true) return antwort({ error: "Dieses Abo kannst du nicht verwalten." }, 403);

  const admin = dienst();
  const { data: abo } = await admin.from("abos").select("*").eq("id", abo_id).single();
  if (!abo || !["active", "trialing", "past_due", "paused_by_organization"].includes(abo.status)) {
    return antwort({ error: "Dieses Abo ist nicht aktiv." }, 400);
  }
  if (abo.anbieter === "manuell" || !abo.anbieter_abo_id) return antwort({ error: "Dieses Abo verwaltet der TanzRaum-Support – bitte schreib an info@tanzraum.app." }, 400);

  try {
    let laeuftBis: string | null = abo.laeuft_bis;
    if (abo.anbieter === "stripe") {
      const sub = await stripe(`subscriptions/${abo.anbieter_abo_id}`, "POST", { cancel_at_period_end: "true" });
      laeuftBis = stripeStatus(sub).laeuftBis ?? laeuftBis;
    } else {
      await paypal(`/v1/billing/subscriptions/${abo.anbieter_abo_id}/cancel`, "POST", { reason: "Kündigung durch den Nutzer in TanzRaum" });
    }
    const bis = laeuftBis ?? new Date().toISOString();
    const { error } = await admin.rpc("abo_aktualisieren", {
      p_abo_id: abo.id, p_status: "cancelled", p_laeuft_bis: bis, p_gekuendigt_zum: bis,
      p_anbieter_abo_id: null, p_anbieter_kunde_id: null, p_grund: "gekuendigt",
    });
    if (error) throw new Error("abo_aktualisieren");
    return antwort({ ok: true, bis });
  } catch (e) {
    return antwort({ error: e instanceof ZahlungsFehler ? e.message : "Die Kündigung hat gerade nicht geklappt. Bitte versuche es später erneut." }, 502);
  }
});
