// Supabase Edge Function: spendenbescheinigung-senden
// Versendet eine Spendenbescheinigung (Zuwendungsbestaetigung) an die beim Spendeneintrag hinterlegte Adresse.
//
//   POST { spende_id }   (Authorization: Bearer <Nutzer-JWT>)
//
// Serverseitige Pruefung:
//   - angemeldet und berechtigt (mail_darf_spendenbescheinigung: Vereinsadmin des Vereins der Spende, mit Lizenz)
//   - Empfaenger ist ausschliesslich die gespeicherte Spender-Adresse (nicht frei waehlbar)
//   - Inhalt wird serverseitig aus den gespeicherten Daten erzeugt (escaped); Absender fest
//   - Ratenbegrenzung: 3 Versandvorgaenge pro Spende und Tag

import { CORS, esc, istEmail, json, layout, NEUTRALER_FEHLER, sendeMail } from "../_shared/mail.ts";
import { angemeldet, dienst, protokollieren, UUID, versandSeit } from "../_shared/zugriff.ts";

const ART = "spendenbescheinigung";

const datum = (d: string) => new Date(d).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
const betrag = (n: unknown) => Number(n ?? 0).toFixed(2).replace(".", ",") + " €";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  const sitzung = await angemeldet(req);
  if (!sitzung) return json({ error: "Bitte melde dich an." }, 401);

  let spendeId: unknown;
  try {
    const b = await req.json();
    spendeId = b.spende_id ?? b.spendeId;
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  if (typeof spendeId !== "string" || !UUID.test(spendeId)) return json({ error: "Ungültige Spende." }, 400);

  const { data: darf } = await sitzung.nutzer.rpc("mail_darf_spendenbescheinigung", { p_spende_id: spendeId });
  if (darf !== true) return json({ error: "Nicht berechtigt." }, 403);

  const admin = dienst();
  const { data: s } = await admin.from("spenden").select("*").eq("id", spendeId).maybeSingle();
  if (!s) return json({ error: "Spende nicht gefunden." }, 404);
  if (!istEmail(s.email)) return json({ error: "Für diese Spende ist keine gültige E-Mail-Adresse hinterlegt." }, 400);
  if ((await versandSeit(admin, { art: ART, bezug_id: spendeId }, 24)) >= 3) {
    return json({ error: "Diese Bescheinigung wurde heute bereits mehrfach versendet." }, 429);
  }

  const { data: v } = await admin.from("vereine").select("*").eq("id", s.verein_id).maybeSingle();
  const vereinAdresse = [[v?.strasse, v?.hausnummer].filter(Boolean).join(" "), [v?.plz, v?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const spenderAdresse = [[s.spender_strasse, s.spender_hausnummer].filter(Boolean).join(" "), [s.spender_plz, s.spender_ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const bestaetigung =
    s.spendenart === "geld"
      ? `Es wird bestätigt, dass <strong>${esc(s.spender_name)}</strong> am ${esc(datum(s.datum))} eine Geldzuwendung in Höhe von <strong>${esc(betrag(s.betrag))}</strong> geleistet hat.`
      : `Es wird bestätigt, dass <strong>${esc(s.spender_name)}</strong> am ${esc(datum(s.datum))} eine Sachzuwendung geleistet hat: ${esc(s.sachspende_beschreibung ?? "")}.`;
  const freistellung = v?.spenden_freistellung_datum
    ? `Der Verein ist wegen Förderung gemeinnütziger Zwecke durch Freistellungsbescheid des Finanzamts ${esc(v.spenden_finanzamt ?? "")}${v.spenden_steuernummer ? `, Steuernummer ${esc(v.spenden_steuernummer)}` : ""}, vom ${esc(datum(v.spenden_freistellung_datum))} von der Körperschaftsteuer befreit.`
    : null;

  const vereinName = v?.name ?? "Dein Verein";
  const html = layout({
    vorschau: `Deine Spendenbescheinigung von ${vereinName}.`,
    titel: "Bestätigung über Zuwendungen",
    absaetze: [
      `<span style="font-size:13px;color:#5f6778;">Bescheinigungs-Nr. ${esc(s.bescheinigungsnummer ?? "–")}</span>`,
      `<strong>${esc(vereinName)}</strong>${vereinAdresse ? `<br>${esc(vereinAdresse)}` : ""}`,
      "<strong>Bestätigung über Zuwendungen im Sinne des § 10b EStG</strong>",
      bestaetigung,
      `<strong>Spender/in:</strong><br>${esc(s.spender_name)}${spenderAdresse ? `<br>${esc(spenderAdresse)}` : ""}`,
      ...(s.verwendungszweck ? [`<strong>Verwendungszweck:</strong> ${esc(s.verwendungszweck)}`] : []),
      "Es wird bestätigt, dass es sich nicht um Mitgliedsbeiträge handelt und dass für die Zuwendung keine Gegenleistung erfolgt ist.",
      ...(freistellung ? [freistellung] : []),
    ],
    hinweis: `Diese Bescheinigung wurde von ${esc(vereinName)} über TanzRaum erstellt. Bei Fragen wende dich bitte direkt an deinen Verein.`,
  });

  const r = await sendeMail({ art: ART, an: [{ email: s.email, name: s.spender_name }], betreff: `Spendenbescheinigung von ${vereinName}`, html });
  await protokollieren(admin, { art: ART, absender_user: sitzung.userId, verein_id: s.verein_id, bezug_id: spendeId, erfolgreich: r.ok });
  if (!r.ok) return json({ error: NEUTRALER_FEHLER }, 502);

  await admin.from("spenden").update({ versendet: true }).eq("id", spendeId);
  return json({ ok: true });
});
