// Abgleich (verify_jwt: false, per pg_cron alle 10 Minuten, Header x-tanzraum-geheimnis). Mit ?selbsttest=1 nur Einrichtungspruefung.
// Handelt nur nach dem Stand in der Datenbank:
// - persoenliches BASIC, dessen Inhaber ueber eine aktive Vereinslizenz abgedeckt ist -> beim Anbieter pausieren
//   (Stripe: pause_collection, PayPal: suspend) -> Status paused_by_organization (keine doppelte Zahlung)
// - pausiertes BASIC ohne Vereinsabdeckung mehr -> beim Anbieter fortsetzen -> active
// Das Abo wird dabei nie geloescht oder neu angelegt.

import { JSON_KOPF, dienst, paypal, stripe, zahlungsDiagnose } from "../_shared/zahlung.ts";

Deno.serve(async (req) => {
  const admin = dienst();
  // Nur der eigene Cron-Job (Geheimnis aus dem Vault) darf den Abgleich ausloesen
  const { data: erlaubt } = await admin.rpc("interner_aufruf_ok", { p_geheimnis: req.headers.get("x-tanzraum-geheimnis") });
  if (erlaubt !== true) return new Response("Nicht berechtigt", { status: 401 });
  // ?selbsttest=1: nur Einrichtung pruefen (keine Schluessel in der Antwort), kein Abgleich
  if (new URL(req.url).searchParams.has("selbsttest")) return new Response(JSON.stringify(await zahlungsDiagnose()), { headers: JSON_KOPF });
  await admin.rpc("abos_ablaufen");
  const { data: liste, error } = await admin.rpc("abo_abgleich_liste");
  if (error) return new Response(JSON.stringify({ error: "Abgleich fehlgeschlagen" }), { status: 500, headers: JSON_KOPF });

  let ok = 0;
  let fehler = 0;
  for (const a of (liste ?? []) as { abo_id: string; anbieter: string; anbieter_abo_id: string | null; aktion: string; verein_id: string | null }[]) {
    const pausieren = a.aktion === "pausieren";
    try {
      if (a.anbieter === "stripe" && a.anbieter_abo_id) {
        await stripe(`subscriptions/${a.anbieter_abo_id}`, "POST", pausieren ? { pause_collection: { behavior: "void" } } : { pause_collection: "" });
      } else if (a.anbieter === "paypal" && a.anbieter_abo_id) {
        await paypal(`/v1/billing/subscriptions/${a.anbieter_abo_id}/${pausieren ? "suspend" : "activate"}`, "POST", {
          reason: pausieren ? "Zugang über Vereinslizenz – persönliches Abo pausiert" : "Vereinsabdeckung beendet – persönliches Abo fortgesetzt",
        });
      }
      const { error: e } = await admin.rpc("abo_pause_setzen", { p_abo_id: a.abo_id, p_pausieren: pausieren, p_verein_id: a.verein_id });
      if (e) throw new Error("abo_pause_setzen");
      ok++;
    } catch {
      fehler++;
      await admin.from("abos").update({ letzter_fehler: pausieren ? "Pausieren beim Anbieter fehlgeschlagen" : "Fortsetzen beim Anbieter fehlgeschlagen" }).eq("id", a.abo_id);
    }
  }
  // Vereinslizenz per Ueberweisung: 30 Tage vor Ablauf Zahlungsaufforderung anlegen und versenden
  let aufforderungen = 0;
  const { data: neu } = await admin.rpc("ueberweisung_verlaengerungen");
  for (const id of (neu ?? []) as string[]) {
    const { error: e } = await admin.functions.invoke("zahlungsaufforderung", { body: { aufforderung_id: id, aktion: "senden" } });
    if (!e) aufforderungen++;
  }
  return new Response(JSON.stringify({ ok, fehler, aufforderungen }), { headers: JSON_KOPF });
});
