// Gemeinsames E-Mail-Modul fuer alle TanzRaum Edge Functions (Versand ueber Brevo).
//
// - Absender ist IMMER fest: TanzRaum <noreply@tanzraum.app> (vom Aufrufer nicht aenderbar)
// - Antworten gehen an die Support-Adresse info@tanzraum.app
// - Brevo-API-Key nur aus dem Supabase Secret BREVO_API_KEY
// - In Logs landen weder Adressen, Inhalte, Tokens noch Brevo-Antworttexte, nur Art + HTTP-Status

export const ABSENDER = { name: "TanzRaum", email: "noreply@tanzraum.app" };
export const ANTWORT_AN = { name: "TanzRaum Support", email: "info@tanzraum.app" };
export const SUPPORT_MAIL = "info@tanzraum.app";
export const LOGO_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/auth-email?logo=1`;
export const NEUTRALER_FEHLER = "Die E-Mail konnte momentan nicht versendet werden. Bitte versuche es später erneut.";

export type Empfaenger = { email: string; name?: string };

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function istEmail(wert: unknown): wert is string {
  return typeof wert === "string" && wert.length <= 254 && EMAIL.test(wert.trim());
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function nurText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|h3|tr|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Einheitliches TanzRaum-Layout (responsive, tabellenbasiert fuer alle Mailprogramme)
// ---------------------------------------------------------------------------------------------
export function layout(opts: {
  vorschau: string; // Vorschautext im Posteingang
  titel: string;
  absaetze: string[]; // bereits escaped/HTML
  button?: { text: string; url: string };
  nachButton?: string[]; // Absaetze nach dem Button (escaped/HTML)
  hinweis?: string; // grauer Sicherheitshinweis (escaped/HTML)
  fallbackLink?: boolean; // Link unter dem Button anzeigen
  fuss?: string; // zusaetzliche Fusszeile (escaped/HTML)
}): string {
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1b2130;">${t}</p>`;
  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 8px;">
        <tr><td align="center" bgcolor="#e11d2e" style="border-radius:999px;">
          <a href="${esc(opts.button.url)}" target="_blank" rel="noopener"
             style="display:inline-block;padding:15px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(opts.button.text)}</a>
        </td></tr></table>`
    : "";
  const fallback =
    opts.button && opts.fallbackLink !== false
      ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#5f6778;">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
         <a href="${esc(opts.button.url)}" style="color:#e11d2e;word-break:break-all;">${esc(opts.button.url)}</a></p>`
      : "";
  const hinweis = opts.hinweis
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;"><tr>
        <td style="background:#f5f6f9;border-left:4px solid #c9921f;border-radius:10px;padding:14px 16px;font-size:13.5px;line-height:1.55;color:#5f6778;">${opts.hinweis}</td>
       </tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(opts.titel)}</title>
<style>
  @media (max-width:620px){ .karte{border-radius:0!important} .innen{padding:28px 22px!important} h1{font-size:22px!important} }
  a{color:#e11d2e}
</style></head>
<body style="margin:0;padding:0;background:#f5f6f9;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.vorschau)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f6f9">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" class="karte" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(27,33,48,0.08);">
    <tr><td style="height:6px;background:#e11d2e;background-image:linear-gradient(90deg,#e11d2e,#c9921f);font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td align="center" style="padding:28px 24px 8px;">
      <img src="${LOGO_URL}" width="260" alt="TanzRaum – Die Plattform für Tanzsport &amp; Gemeinschaft" style="display:block;width:260px;max-width:80%;height:auto;border:0;">
    </td></tr>
    <tr><td class="innen" style="padding:24px 40px 36px;font-family:Arial,Helvetica,sans-serif;">
      <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#1b2130;font-weight:bold;">${esc(opts.titel)}</h1>
      ${opts.absaetze.map(p).join("\n")}
      ${button}
      ${fallback}
      ${(opts.nachButton ?? []).map((t) => `<p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#1b2130;">${t}</p>`).join("\n")}
      ${hinweis}
    </td></tr>
    <tr><td style="background:#1b2130;padding:22px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.6;color:#c8ccd6;" align="center">
      <strong style="color:#ffffff;">TanzRaum</strong> · Gemeinsam. Organisiert. Verbunden.<br>
      Fragen? Schreib uns an <a href="mailto:${SUPPORT_MAIL}" style="color:#f2d58c;">${SUPPORT_MAIL}</a>
      ${opts.fuss ? `<br><span style="color:#98a0b0;">${opts.fuss}</span>` : ""}
      <br><span style="color:#98a0b0;">Dies ist eine automatische Nachricht – bitte nicht direkt auf diese E-Mail antworten.</span>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// ---------------------------------------------------------------------------------------------
// Versand ueber Brevo (transaktionale E-Mails)
// ---------------------------------------------------------------------------------------------
export async function sendeMail(opts: {
  art: string; // nur fuer Logs/Tags, z. B. "passwort-reset"
  an: Empfaenger[]; // bei mehreren Empfaengern erhaelt jede Person eine eigene E-Mail
  betreff: string;
  html: string;
  antwortAn?: Empfaenger;
}): Promise<{ ok: boolean; gesendet: number }> {
  const schluessel = Deno.env.get("BREVO_API_KEY")?.trim();
  if (!schluessel) {
    console.error(`[mail:${opts.art}] BREVO_API_KEY fehlt`);
    return { ok: false, gesendet: 0 };
  }
  const empfaenger = opts.an.filter((e) => istEmail(e.email)).map((e) => ({ email: e.email.trim(), ...(e.name ? { name: e.name.slice(0, 100) } : {}) }));
  if (empfaenger.length === 0) return { ok: false, gesendet: 0 };

  const text = nurText(opts.html);
  let gesendet = 0;
  // Brevo: bis zu 1000 Versionen pro Anfrage; jede Version = eigene E-Mail an genau eine Person
  for (let i = 0; i < empfaenger.length; i += 500) {
    const teil = empfaenger.slice(i, i + 500);
    const body = {
      sender: ABSENDER,
      replyTo: opts.antwortAn && istEmail(opts.antwortAn.email) ? opts.antwortAn : ANTWORT_AN,
      subject: opts.betreff.slice(0, 200),
      htmlContent: opts.html,
      textContent: text,
      tags: ["tanzraum", opts.art],
      headers: { "X-Mailin-custom": `art:${opts.art}` },
      ...(teil.length === 1 ? { to: teil } : { messageVersions: teil.map((e) => ({ to: [e] })) }),
    };
    try {
      const antwort = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": schluessel, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (antwort.ok) gesendet += teil.length;
      else console.error(`[mail:${opts.art}] Brevo-Versand fehlgeschlagen, HTTP ${antwort.status}`);
      await antwort.body?.cancel();
    } catch {
      console.error(`[mail:${opts.art}] Brevo nicht erreichbar`);
    }
  }
  return { ok: gesendet === empfaenger.length, gesendet };
}

// ---------------------------------------------------------------------------------------------
// Hilfen fuer Edge Functions
// ---------------------------------------------------------------------------------------------
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(daten: unknown, status = 200) {
  return new Response(JSON.stringify(daten), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

// Service-Schluessel (neues Format SUPABASE_SECRET_KEYS, sonst Legacy)
export function serviceSchluessel(): string {
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (k.default) return k.default;
  } catch {
    /* Legacy */
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

// Zeitkonstanter Vergleich (fuer Server-zu-Server-Schluessel)
export function gleich(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length || x.length === 0) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

// Oeffentliche Adresse der TanzRaum-App (fuer Links in E-Mails)
export function appUrl(): string {
  return (Deno.env.get("TANZRAUM_APP_URL") ?? "https://tanzraum.app").replace(/\/+$/, "");
}
