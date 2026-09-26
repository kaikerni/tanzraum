// Supabase Edge Function: eltern-zustimmung
// Versendet die Mails fuer Kinderkonten unter 16 (Zustimmung eines Elternteils bzw. Traegers der elterlichen
// Verantwortung). Kein allgemeines Mail-Relay: Empfaenger ist ausschliesslich die bei der Zustimmung gespeicherte
// Eltern-Adresse, Inhalt, Link und Absender legt der Server fest.
//
//   POST { art: "anfrage", kind_id }            -> Zustimmungslink an das Elternteil (einmalig, begrenzt gueltig)
//   POST { art: "bestaetigung", zustimmung_id } -> Bestaetigung + einmaliger Link zum Verknuepfen eines Elternkontos
//
// Aufruf ohne Anmeldung (das Kinderkonto ist bis zur Zustimmung gesperrt). Missbrauchsschutz: nur fuer vorhandene,
// passende Zustimmungsdatensaetze; hoechstens 5 Anfrage-Mails je Kinderkonto, frühestens alle 5 Minuten.
// Tokens werden nur als SHA-256-Hash gespeichert und nie geloggt.

import { appUrl, CORS, json, NEUTRALER_FEHLER, sendeMail } from "../_shared/mail.ts";
import { elternZustimmungAnfrage, elternZustimmungBestaetigt } from "./vorlagen.ts";
import { dienst, protokollieren, UUID } from "../_shared/zugriff.ts";

const TAG = 24 * 3600_000;

function zufallsToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(h, (x) => x.toString(16).padStart(2, "0")).join("");
}

function datum(d: Date): string {
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  let art: unknown, kindId: unknown, zustimmungId: unknown;
  try {
    ({ art, kind_id: kindId, zustimmung_id: zustimmungId } = await req.json());
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  const admin = dienst();

  if (art === "anfrage") {
    if (typeof kindId !== "string" || !UUID.test(kindId)) return json({ error: "Ungültige Anfrage." }, 400);
    const { data: z } = await admin
      .from("eltern_zustimmungen")
      .select("id, kind_id, eltern_email, loeschen_ab, mails_gesendet, letzte_mail_am")
      .eq("kind_id", kindId)
      .eq("status", "offen")
      .maybeSingle();
    // Keine Auskunft, ob ein Konto existiert
    if (!z) return json({ ok: true });
    if (z.mails_gesendet >= 5 || (z.letzte_mail_am && Date.now() - new Date(z.letzte_mail_am).getTime() < 5 * 60_000)) {
      return json({ error: "Die E-Mail an deine Eltern wurde gerade erst verschickt. Bitte warte ein paar Minuten." }, 429);
    }
    const token = zufallsToken();
    const grenze = z.loeschen_ab ? Math.min(new Date(z.loeschen_ab).getTime(), Date.now() + 14 * TAG) : Date.now() + 14 * TAG;
    const gueltigBis = new Date(grenze);
    const { data: kind } = await admin.from("profiles").select("vorname").eq("id", z.kind_id).maybeSingle();
    const { error } = await admin
      .from("eltern_zustimmungen")
      .update({
        token_hash: await sha256(token),
        token_laeuft_ab: gueltigBis.toISOString(),
        mails_gesendet: z.mails_gesendet + 1,
        letzte_mail_am: new Date().toISOString(),
      })
      .eq("id", z.id)
      .eq("status", "offen");
    if (error) return json({ error: NEUTRALER_FEHLER }, 500);
    const mail = elternZustimmungAnfrage({
      kindVorname: kind?.vorname ?? "",
      link: `${appUrl()}/eltern/zustimmung?token=${encodeURIComponent(token)}`,
      gueltigBis: datum(gueltigBis),
    });
    const r = await sendeMail({ art: "eltern-zustimmung", an: [{ email: z.eltern_email }], betreff: mail.betreff, html: mail.html });
    await protokollieren(admin, { art: "eltern-zustimmung", bezug_id: z.id, erfolgreich: r.ok });
    if (!r.ok) return json({ error: NEUTRALER_FEHLER }, 502);
    return json({ ok: true });
  }

  if (art === "bestaetigung") {
    if (typeof zustimmungId !== "string" || !UUID.test(zustimmungId)) return json({ error: "Ungültige Anfrage." }, 400);
    const { data: z } = await admin
      .from("eltern_zustimmungen")
      .select("id, kind_id, eltern_email, entschieden_am, umfang, bestaetigung_gesendet_am")
      .eq("id", zustimmungId)
      .eq("status", "zugestimmt")
      .maybeSingle();
    // Nur einmal und nur direkt nach der Zustimmung
    if (!z || z.bestaetigung_gesendet_am || !z.entschieden_am || Date.now() - new Date(z.entschieden_am).getTime() > 3600_000) {
      return json({ ok: true });
    }
    const token = zufallsToken();
    const { data: kind } = await admin.from("profiles").select("vorname").eq("id", z.kind_id).maybeSingle();
    const { error } = await admin
      .from("eltern_zustimmungen")
      .update({
        verknuepf_token_hash: await sha256(token),
        verknuepf_laeuft_ab: new Date(Date.now() + 30 * TAG).toISOString(),
        bestaetigung_gesendet_am: new Date().toISOString(),
      })
      .eq("id", z.id)
      .is("bestaetigung_gesendet_am", null);
    if (error) return json({ error: NEUTRALER_FEHLER }, 500);
    const mail = elternZustimmungBestaetigt({
      kindVorname: kind?.vorname ?? "",
      datum: datum(new Date(z.entschieden_am)),
      push: z.umfang?.push === true,
      link: `${appUrl()}/eltern/verknuepfen?token=${encodeURIComponent(token)}`,
    });
    const r = await sendeMail({ art: "eltern-bestaetigung", an: [{ email: z.eltern_email }], betreff: mail.betreff, html: mail.html });
    await protokollieren(admin, { art: "eltern-bestaetigung", bezug_id: z.id, erfolgreich: r.ok });
    if (!r.ok) return json({ error: NEUTRALER_FEHLER }, 502);
    return json({ ok: true });
  }

  return json({ error: "Ungültige Anfrage." }, 400);
});
