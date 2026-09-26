// Supabase Edge Function: rechnung-versenden
// Versendet eine bereits erstellte Rechnung (Tabelle rechnungen) an die dort gespeicherte Adresse.
//
//   POST { rechnung_id }
//
// Zugriff (verify_jwt aus, Pruefung hier):
//   - Server-zu-Server: Authorization: Bearer <Supabase Secret Key>  (Aufruf durch paypal-webhook), zeitkonstant verglichen
//   - oder angemeldete Plattform-Administration (ist_plattform_admin_aktuell), z. B. fuer einen erneuten Versand
// Empfaenger ist ausschliesslich rechnungen.empfaenger_email; Inhalt serverseitig erzeugt und escaped; Absender fest.
// Ratenbegrenzung: 3 Versandvorgaenge pro Rechnung und Tag.

import { CORS, esc, gleich, istEmail, json, layout, NEUTRALER_FEHLER, sendeMail, serviceSchluessel } from "../_shared/mail.ts";
import { angemeldet, dienst, protokollieren, UUID, versandSeit } from "../_shared/zugriff.ts";

const ART = "rechnung";
const euro = (n: unknown) => Number(n ?? 0).toFixed(2).replace(".", ",") + " €";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let ausloeser: string | null = null;
  if (!gleich(bearer, serviceSchluessel())) {
    const sitzung = await angemeldet(req);
    if (!sitzung) return json({ error: "Nicht berechtigt." }, 401);
    const { data: istAdmin } = await sitzung.nutzer.rpc("ist_plattform_admin_aktuell");
    if (istAdmin !== true) return json({ error: "Nicht berechtigt." }, 403);
    ausloeser = sitzung.userId;
  }

  let rechnungId: unknown;
  try {
    ({ rechnung_id: rechnungId } = await req.json());
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  if (typeof rechnungId !== "string" || !UUID.test(rechnungId)) return json({ error: "Ungültige Rechnung." }, 400);

  const admin = dienst();
  const [{ data: r }, { data: s }] = await Promise.all([
    admin.from("rechnungen").select("*").eq("id", rechnungId).maybeSingle(),
    admin.from("rechnungs_einstellungen").select("*").eq("id", true).maybeSingle(),
  ]);
  if (!r || !s) return json({ error: "Rechnung nicht gefunden." }, 404);
  if (!istEmail(r.empfaenger_email)) return json({ error: "Für diese Rechnung ist keine gültige E-Mail-Adresse hinterlegt." }, 400);
  if ((await versandSeit(admin, { art: ART, bezug_id: rechnungId }, 24)) >= 3) {
    return json({ error: "Diese Rechnung wurde heute bereits mehrfach versendet." }, 429);
  }

  const datum = new Date(r.rechnungsdatum).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  const zelle = "padding:10px 6px;border-bottom:1px solid #e6e8ee;font-size:14px;";
  const tabelle = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0;">
    <tr><th align="left" style="${zelle}border-bottom:2px solid #1b2130;">Leistung</th><th align="left" style="${zelle}border-bottom:2px solid #1b2130;">Zeitraum</th><th align="right" style="${zelle}border-bottom:2px solid #1b2130;">Betrag</th></tr>
    <tr><td style="${zelle}">${esc(r.leistung)}</td><td style="${zelle}">${r.zeitraum === "jahr" ? "1 Jahr" : "1 Monat"}</td><td align="right" style="${zelle}font-weight:bold;">${esc(euro(r.betrag))}</td></tr>
    <tr><td colspan="3" align="right" style="padding:14px 6px 0;font-size:16px;font-weight:bold;">Gesamtbetrag: ${esc(euro(r.betrag))}</td></tr>
  </table>`;

  const html = layout({
    vorschau: `Deine TanzRaum-Rechnung ${r.nummer}.`,
    titel: `Rechnung ${r.nummer}`,
    absaetze: [
      `<strong>${esc(s.firmenzeile)}</strong><br>${esc(s.adresse)}${s.steuernummer ? `<br>Steuernummer: ${esc(s.steuernummer)}` : ""}`,
      `<strong>Rechnung an:</strong><br>${esc(r.empfaenger_name)}${r.empfaenger_adresse ? `<br>${esc(r.empfaenger_adresse)}` : ""}<br>${esc(r.empfaenger_email)}`,
      `Rechnungsdatum: <strong>${esc(datum)}</strong>`,
      tabelle,
      `Zahlungsart: ${r.zahlungsweg === "paypal" ? "PayPal" : "Überweisung"} – bereits vollständig beglichen.`,
    ],
    hinweis: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung). Diese Rechnung wurde automatisch erstellt und ist ohne Unterschrift gültig.",
  });

  const ok = (await sendeMail({ art: ART, an: [{ email: r.empfaenger_email, name: r.empfaenger_name }], betreff: `Deine TanzRaum-Rechnung ${r.nummer}`, html })).ok;
  await protokollieren(admin, { art: ART, absender_user: ausloeser, verein_id: r.ziel_verein_id, bezug_id: rechnungId, erfolgreich: ok });
  if (!ok) return json({ error: NEUTRALER_FEHLER }, 502);

  await admin.from("rechnungen").update({ versendet: true, versendet_am: new Date().toISOString() }).eq("id", rechnungId);
  return json({ ok: true, nummer: r.nummer });
});
