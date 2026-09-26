// Supabase Edge Function: send-beitritt-einladung
// Versendet eine bestehende Vereins- bzw. Gruppeneinladung per E-Mail.
//
//   POST { einladung_id, email }   (Authorization: Bearer <Nutzer-JWT>)
//
// Serverseitige Pruefung:
//   - angemeldet; Einladungsdaten werden ALS Nutzer ueber mail_einladung_daten() gelesen:
//     nur Vereinsadmin des Vereins, Verein mit Lizenz, Einladung gueltig (nicht widerrufen/abgelaufen/aufgebraucht)
//   - Empfaengeradresse wird validiert; Inhalt, Link und Absender legt ausschliesslich der Server fest
//   - Ratenbegrenzung: 30 Einladungs-Mails pro Nutzer und Stunde, 10 pro Einladung und Tag
// Link: <App>/einladung/<token>  (keine alten *.html-Seiten mehr)

import { appUrl, CORS, istEmail, json, NEUTRALER_FEHLER, sendeMail } from "../_shared/mail.ts";
import { vereinsEinladung } from "../_shared/vorlagen.ts";
import { angemeldet, dienst, protokollieren, UUID, versandSeit } from "../_shared/zugriff.ts";

const ART = "einladung";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  const sitzung = await angemeldet(req);
  if (!sitzung) return json({ error: "Bitte melde dich an." }, 401);

  let einladungId: unknown, email: unknown;
  try {
    ({ einladung_id: einladungId, email } = await req.json());
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  if (typeof einladungId !== "string" || !UUID.test(einladungId)) return json({ error: "Ungültige Einladung." }, 400);
  if (!istEmail(email)) return json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }, 400);

  const { data, error } = await sitzung.nutzer.rpc("mail_einladung_daten", { p_einladung_id: einladungId });
  const e = Array.isArray(data) ? data[0] : null;
  if (error || !e) return json({ error: "Nicht berechtigt oder Einladung nicht mehr gültig." }, 403);

  const admin = dienst();
  if (
    (await versandSeit(admin, { art: ART, absender_user: sitzung.userId }, 1)) >= 30 ||
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
