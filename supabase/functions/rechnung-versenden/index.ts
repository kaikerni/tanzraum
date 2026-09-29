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
// Die Rechnung selbst haengt als PDF an (Logo, Aussteller, Empfaenger, Leistungszeitraum – _shared/rechnung-pdf.ts).

import { appUrl, CORS, esc, gleich, istEmail, json, layout, NEUTRALER_FEHLER, sendeMail, serviceSchluessel } from "../_shared/mail.ts";
import { angemeldet, dienst, protokollieren, UUID, versandSeit } from "../_shared/zugriff.ts";
import { dateiname, datumDe, euro, rechnungLogo, rechnungPdf, zahlungsartText } from "../_shared/rechnung-pdf.ts";

const ART = "rechnung";

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
    // Rechnungssteller und Kleinunternehmer-Hinweis zentral aus plattform_anbieter
    admin.from("plattform_anbieter").select("*").eq("id", true).maybeSingle(),
  ]);
  if (!r || !s) return json({ error: "Rechnung nicht gefunden." }, 404);
  if (!istEmail(r.empfaenger_email)) return json({ error: "Für diese Rechnung ist keine gültige E-Mail-Adresse hinterlegt." }, 400);
  if ((await versandSeit(admin, { art: ART, bezug_id: rechnungId }, 24)) >= 3) {
    return json({ error: "Diese Rechnung wurde heute bereits mehrfach versendet." }, 429);
  }

  if (r.anonymisiert_am) return json({ error: "Diese Rechnung ist anonymisiert und kann nicht mehr versendet werden." }, 400);
  // Aussteller wie auf der Rechnung (Stand bei Erstellung), aeltere Rechnungen ohne Stand: aktuelle Angaben
  const a = r.aussteller ?? s;
  const datum = datumDe(r.rechnungsdatum);
  const zeitraumText = r.leistung_von ? `${datumDe(r.leistung_von)} – ${datumDe(r.leistung_bis)}` : r.zeitraum === "jahr" ? "1 Jahr" : "1 Monat";
  const zelle = "padding:10px 6px;border-bottom:1px solid #e6e8ee;font-size:14px;";
  const tabelle = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0;">
    <tr><th align="left" style="${zelle}border-bottom:2px solid #1b2130;">Leistung</th><th align="left" style="${zelle}border-bottom:2px solid #1b2130;">Zeitraum</th><th align="right" style="${zelle}border-bottom:2px solid #1b2130;">Betrag</th></tr>
    <tr><td style="${zelle}">${esc(r.leistung)}</td><td style="${zelle}">${esc(zeitraumText)}</td><td align="right" style="${zelle}font-weight:bold;">${esc(euro(r.betrag))}</td></tr>
    <tr><td colspan="3" align="right" style="padding:14px 6px 0;font-size:16px;font-weight:bold;">Gesamtbetrag: ${esc(euro(r.betrag))}</td></tr>
  </table>`;

  const html = layout({
    vorschau: `Deine TanzRaum-Rechnung ${r.nummer}.`,
    titel: `Rechnung ${r.nummer}`,
    absaetze: [
      `<strong>${esc(a.unternehmen ? `${a.name} – ${a.unternehmen}` : a.name)}</strong><br>${esc(`${a.strasse}, ${a.plz} ${a.ort}`)}` +
        `${a.steuernummer ? `<br>Steuernummer: ${esc(a.steuernummer)}` : ""}${a.ust_id ? `<br>USt-IdNr.: ${esc(a.ust_id)}` : ""}`,
      `<strong>Rechnung an:</strong><br>${esc(r.empfaenger_name)}${r.empfaenger_adresse ? `<br>${esc(r.empfaenger_adresse)}` : ""}<br>${esc(r.empfaenger_email)}`,
      `Rechnungsdatum: <strong>${esc(datum)}</strong>`,
      tabelle,
      `Zahlungsart: ${zahlungsartText(r.zahlungsweg)} – bereits vollständig beglichen.`,
      "Die vollständige Rechnung findest du als PDF im Anhang.",
    ],
    hinweis: `${a.kleinunternehmer ? `${a.kleinunternehmer_hinweis} ` : ""}Diese Rechnung wurde automatisch erstellt und ist ohne Unterschrift gültig.`,
  });

  let pdf: Uint8Array | null = null;
  try {
    pdf = await rechnungPdf([r], await rechnungLogo(appUrl()));
  } catch {
    console.error("[rechnung] PDF konnte nicht erzeugt werden");
  }
  const ok = (
    await sendeMail({
      art: ART,
      an: [{ email: r.empfaenger_email, name: r.empfaenger_name }],
      betreff: `Deine TanzRaum-Rechnung ${r.nummer}`,
      html,
      anhaenge: pdf ? [{ name: dateiname(r.nummer), inhalt: pdf }] : [],
    })
  ).ok;
  await protokollieren(admin, { art: ART, absender_user: ausloeser, verein_id: r.ziel_verein_id, bezug_id: rechnungId, erfolgreich: ok });
  if (!ok) return json({ error: NEUTRALER_FEHLER }, 502);

  await admin.from("rechnungen").update({ versendet: true, versendet_am: new Date().toISOString() }).eq("id", rechnungId);
  return json({ ok: true, nummer: r.nummer });
});
