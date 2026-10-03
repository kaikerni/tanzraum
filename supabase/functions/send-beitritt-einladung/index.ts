// Supabase Edge Function: send-beitritt-einladung
// Versendet eine bestehende Vereins- bzw. Gruppeneinladung per E-Mail.
//
//   POST { einladung_id, email }   (Authorization: Bearer <Nutzer-JWT>)
//   POST { freischaltung_id }      kostenlose Sonderfreischaltung (nur TanzRaum-Admin; Empfaenger aus der Einladung)
//
// Serverseitige Pruefung:
//   - angemeldet; Einladungsdaten werden ALS Nutzer ueber mail_einladung_daten() gelesen:
//     nur Vereinsadmin des Vereins, Verein mit Lizenz, Einladung gueltig (nicht widerrufen/abgelaufen/aufgebraucht)
//   - Empfaengeradresse wird validiert; Inhalt, Link und Absender legt ausschliesslich der Server fest
//   - Ratenbegrenzung: 150 Einladungs-Mails pro Nutzer und Stunde (Sammeleinladung nach einem Mitgliederimport),
//     10 pro Einladung und Tag
// Link: <App>/einladung/<token>  (keine alten *.html-Seiten mehr)

import { appUrl, CORS, istEmail, json, NEUTRALER_FEHLER, sendeMail } from "../_shared/mail.ts";
import { freischaltungEinladung, vereinsEinladung } from "../_shared/vorlagen.ts";
import { angemeldet, dienst, protokollieren, UUID, versandSeit } from "../_shared/zugriff.ts";

const ART = "einladung";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  const sitzung = await angemeldet(req);
  if (!sitzung) return json({ error: "Bitte melde dich an." }, 401);

  let einladungId: unknown, email: unknown, freischaltungId: unknown;
  try {
    ({ einladung_id: einladungId, email, freischaltung_id: freischaltungId } = await req.json());
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }

  // Kostenlose Sonderfreischaltung: Berechtigung (nur TanzRaum-Admin) und Empfaenger prueft die Datenbank
  if (freischaltungId !== undefined) {
    if (typeof freischaltungId !== "string" || !UUID.test(freischaltungId)) return json({ error: "Ungültige Einladung." }, 400);
    const { data: fd, error: fe } = await sitzung.nutzer.rpc("mail_freischaltung_daten", { p_id: freischaltungId });
    const f = Array.isArray(fd) ? fd[0] : null;
    if (fe || !f || !istEmail(f.email)) return json({ error: "Nicht berechtigt oder Einladung nicht mehr gültig." }, 403);
    const dienstClient = dienst();
    if ((await versandSeit(dienstClient, { art: "freischaltung", bezug_id: freischaltungId }, 24)) >= 5) {
      return json({ error: "Diese Einladung wurde heute schon mehrfach gesendet. Bitte versuche es später erneut." }, 429);
    }
    const fm = freischaltungEinladung({ tarif: f.tarif, bis: f.bis, link: `${appUrl()}/freischaltung/${f.token}`, gueltigBis: f.gueltig_bis });
    const fr = await sendeMail({ art: "freischaltung", an: [{ email: String(f.email).trim() }], betreff: fm.betreff, html: fm.html });
    await protokollieren(dienstClient, { art: "freischaltung", absender_user: sitzung.userId, bezug_id: freischaltungId, erfolgreich: fr.ok });
    if (!fr.ok) return json({ error: NEUTRALER_FEHLER }, 502);
    await sitzung.nutzer.rpc("admin_freischaltung_gesendet", { p_id: freischaltungId });
    return json({ ok: true });
  }
  if (typeof einladungId !== "string" || !UUID.test(einladungId)) return json({ error: "Ungültige Einladung." }, 400);
  if (!istEmail(email)) return json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }, 400);

  const { data, error } = await sitzung.nutzer.rpc("mail_einladung_daten", { p_einladung_id: einladungId });
  const e = Array.isArray(data) ? data[0] : null;
  if (error || !e) return json({ error: "Nicht berechtigt oder Einladung nicht mehr gültig." }, 403);

  const admin = dienst();
  if (
    (await versandSeit(admin, { art: ART, absender_user: sitzung.userId }, 1)) >= 150 ||
    (await versandSeit(admin, { art: ART, bezug_id: einladungId }, 24)) >= 10
  ) {
    return json({ error: "Zu viele Einladungen in kurzer Zeit. Bitte versuche es später erneut." }, 429);
  }

  const mail = vereinsEinladung({
    vereinName: e.verein_name,
    gruppeName: e.gruppe_name,
    rolle: e.rolle_name,
    einlader: e.einlader,
    link: `${appUrl()}/einladung/${e.token}`,
    gueltigBis: e.gueltig_bis,
  });
  const r = await sendeMail({ art: ART, an: [{ email: (email as string).trim() }], betreff: mail.betreff, html: mail.html });
  await protokollieren(admin, { art: ART, absender_user: sitzung.userId, verein_id: e.verein_id, bezug_id: einladungId, erfolgreich: r.ok });

  if (!r.ok) return json({ error: NEUTRALER_FEHLER }, 502);
  return json({ ok: true });
});
