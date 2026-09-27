// Supabase Edge Function: konto-loeschung (verify_jwt: false)
//
//   POST { art: "bestaetigung", user_id }  -> Mail an die Kontoadresse mit einmaligem Widerrufslink (nach dem Antrag)
//   POST { art: "ausfuehren" }             -> endgueltige Loeschung faelliger Antraege (pg_cron, Header x-tanzraum-geheimnis)
//
// Kein Mail-Relay: Empfaenger ist ausschliesslich die Anmeldeadresse eines Kontos mit offenem Loeschantrag;
// hoechstens 3 Mails je Antrag, fruehestens alle 5 Minuten. Tokens nur als SHA-256-Hash gespeichert, nie geloggt.
// Die Datenbank prueft Hindernisse (Vereinsmitgliedschaft, Lizenz, offene Zahlung ...) vor jeder Loeschung erneut.

import { appUrl, CORS, json, NEUTRALER_FEHLER, sendeMail } from "../_shared/mail.ts";
import { dienst, protokollieren, UUID } from "../_shared/zugriff.ts";
import { kontoLoeschungBestaetigt } from "./vorlagen.ts";

function zufallsToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(h, (x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  let art: unknown, userId: unknown;
  try {
    ({ art, user_id: userId } = await req.json());
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  const admin = dienst();

  if (art === "bestaetigung") {
    if (typeof userId !== "string" || !UUID.test(userId)) return json({ error: "Ungültige Anfrage." }, 400);
    const { data: k } = await admin
      .from("konto_loeschungen")
      .select("user_id, loeschen_ab, mails_gesendet, letzte_mail_am")
      .eq("user_id", userId)
      .maybeSingle();
    // Keine Auskunft, ob ein Konto/Antrag existiert
    if (!k || new Date(k.loeschen_ab).getTime() <= Date.now()) return json({ ok: true });
    if (k.mails_gesendet >= 3 || (k.letzte_mail_am && Date.now() - new Date(k.letzte_mail_am).getTime() < 5 * 60_000)) {
      return json({ error: "Die E-Mail wurde gerade erst verschickt." }, 429);
    }
    const { data: nutzer } = await admin.auth.admin.getUserById(userId);
    const email = nutzer?.user?.email;
    if (!email) return json({ ok: true });
    const token = zufallsToken();
    const { error } = await admin
      .from("konto_loeschungen")
      .update({
        widerruf_token_hash: await sha256(token),
        token_laeuft_ab: k.loeschen_ab,
        mails_gesendet: k.mails_gesendet + 1,
        letzte_mail_am: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) return json({ error: NEUTRALER_FEHLER }, 500);
    const { data: profil } = await admin.from("profiles").select("vorname").eq("id", userId).maybeSingle();
    const mail = kontoLoeschungBestaetigt({
      vorname: profil?.vorname ?? "",
      loeschenAb: new Date(k.loeschen_ab).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }),
      link: `${appUrl()}/konto/widerruf?token=${encodeURIComponent(token)}`,
    });
    const r = await sendeMail({ art: "konto-loeschung", an: [{ email }], betreff: mail.betreff, html: mail.html });
    await protokollieren(admin, { art: "konto-loeschung", bezug_id: userId, erfolgreich: r.ok });
    if (!r.ok) return json({ error: NEUTRALER_FEHLER }, 502);
    return json({ ok: true });
  }

  if (art === "ausfuehren") {
    const geheimnis = req.headers.get("x-tanzraum-geheimnis");
    const { data: erlaubt } = await admin.rpc("interner_aufruf_ok", { p_geheimnis: geheimnis });
    if (erlaubt !== true) return json({ error: "Nicht berechtigt." }, 401);
    const { data: faellig, error } = await admin.rpc("konto_loeschungen_faellig", { p_geheimnis: geheimnis });
    if (error) return json({ error: "Abruf fehlgeschlagen." }, 500);
    let geloescht = 0;
    let fehler = 0;
    for (const f of (faellig ?? []) as { user_id: string; storage: Record<string, string[]> }[]) {
      try {
        // Eigene Dateien zuerst aus dem Speicher entfernen (die Datenbankzeilen verschwinden mit dem Konto)
        for (const [bucket, pfade] of Object.entries(f.storage ?? {})) {
          if (Array.isArray(pfade) && pfade.length) {
            const { error: e } = await admin.storage.from(bucket).remove(pfade);
            if (e) throw new Error("Speicher");
          }
        }
        const { data: ok, error: e } = await admin.rpc("konto_endgueltig_loeschen", { p_geheimnis: geheimnis, p_user: f.user_id });
        if (e) throw new Error("Loeschen");
        if (ok === true) geloescht++;
      } catch {
        fehler++;
      }
    }
    return json({ ok: true, geloescht, fehler });
  }

  return json({ error: "Ungültige Anfrage." }, 400);
});
