// Supabase Edge Function: auth-email  (Supabase Auth "Send Email Hook" -> Brevo)
//
// Supabase Auth ruft diese Funktion fuer ALLE Auth-E-Mails auf (Registrierung, Passwort-Reset, E-Mail-Aenderung,
// Einladung, Anmeldelink, Sicherheitscode, Sicherheitsbenachrichtigungen). Die Anfrage ist per Standard-Webhooks-
// Signatur (Secret SEND_EMAIL_HOOK_SECRET, "v1,whsec_...") abgesichert. Tokens werden nie geloggt.
//
// Links zeigen immer auf die neue TanzRaum-App: <App>/auth/bestaetigen?token_hash=...&type=...&weiter=...
// Die Seite bestaetigt erst nach einem Klick (schuetzt vor Link-Vorschau/Virenscannern, die Links vorab oeffnen).
//
// Zusaetzlich:
//   GET  ?logo=1                                   -> TanzRaum-Logo (PNG) fuer E-Mails
//   POST { selbsttest: true } + x-tanzraum-geheimnis -> Diagnose ohne Geheimnisse (Brevo-Absender/Domain, Secrets)

import { createClient } from "jsr:@supabase/supabase-js@2";
import { appUrl, ABSENDER, istEmail, json, sendeMail, serviceSchluessel } from "../_shared/mail.ts";
import * as V from "../_shared/vorlagen.ts";
import { LOGO_PNG_BASE64 } from "../_shared/logo.ts";

type HookDaten = {
  user: { id: string; email?: string; new_email?: string; user_metadata?: Record<string, unknown> };
  email_data: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type: string;
    site_url?: string;
    old_email?: string;
  };
};

const STANDARD_ZIEL: Record<string, string> = {
  signup: "/dashboard",
  email: "/dashboard",
  invite: "/dashboard",
  magiclink: "/dashboard",
  recovery: "/passwort-neu",
  email_change: "/dashboard/einstellungen?email=bestaetigt",
};
const OTP_TYP: Record<string, string> = { signup: "email", email: "email", invite: "invite", magiclink: "email", recovery: "recovery", email_change: "email_change" };

function b64ToBytes(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Standard-Webhooks-Pruefung (https://www.standardwebhooks.com) ohne Fremdbibliothek
async function signaturGueltig(req: Request, body: string): Promise<boolean> {
  const secret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").trim().replace(/^v1,/, "").replace(/^whsec_/, "");
  const id = req.headers.get("webhook-id");
  const zeit = req.headers.get("webhook-timestamp");
  const signaturen = req.headers.get("webhook-signature");
  if (!secret || !id || !zeit || !signaturen) return false;
  const sekunden = Number(zeit);
  if (!Number.isFinite(sekunden) || Math.abs(Date.now() / 1000 - sekunden) > 300) return false;
  const schluessel = await crypto.subtle.importKey("raw", b64ToBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const erwartet = new Uint8Array(await crypto.subtle.sign("HMAC", schluessel, new TextEncoder().encode(`${id}.${zeit}.${body}`)));
  for (const teil of signaturen.split(" ")) {
    const [version, sig] = teil.split(",");
    if (version !== "v1" || !sig) continue;
    const bytes = b64ToBytes(sig);
    if (bytes.length !== erwartet.length) continue;
    let d = 0;
    for (let i = 0; i < bytes.length; i++) d |= bytes[i] ^ erwartet[i];
    if (d === 0) return true;
  }
  return false;
}

// Basis-URL: Herkunft der von Supabase gepruefeten redirect_to-Adresse (steht auf der Redirect-Allowlist),
// sonst feste App-Adresse (TANZRAUM_APP_URL). Alte *.html-Seiten werden nie verwendet.
function zielBasis(d: HookDaten["email_data"]): { basis: string; pfad: string | null } {
  try {
    const u = new URL(d.redirect_to ?? "");
    const sicher = u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname));
    // Adressen der alten Website (*.html) fuehren nie in die neue App -> feste App-Adresse
    if (sicher && !u.pathname.endsWith(".html")) return { basis: u.origin, pfad: u.pathname !== "/" ? u.pathname + u.search : null };
  } catch {
    /* keine oder ungueltige redirect_to-Adresse */
  }
  return { basis: appUrl(), pfad: null };
}

function bestaetigungsLink(basis: string, tokenHash: string, art: string, pfad: string | null) {
  const weiter = pfad && pfad.startsWith("/") && !pfad.startsWith("//") ? pfad : STANDARD_ZIEL[art] ?? "/dashboard";
  const u = new URL("/auth/bestaetigen", basis);
  u.searchParams.set("token_hash", tokenHash);
  u.searchParams.set("type", OTP_TYP[art] ?? "email");
  u.searchParams.set("weiter", weiter);
  return u.toString();
}

function hookFehler(nachricht: string) {
  return json({ error: { http_code: 500, message: nachricht } }, 500);
}

async function selbsttest() {
  const key = Deno.env.get("BREVO_API_KEY")?.trim();
  const ergebnis: Record<string, unknown> = {
    brevo_api_key_vorhanden: Boolean(key),
    hook_secret_vorhanden: Boolean(Deno.env.get("SEND_EMAIL_HOOK_SECRET")),
    app_url: appUrl(),
    absender: ABSENDER.email,
  };
  if (!key) return ergebnis;
  // Nur die Art des Schluessels (Praefix), nie der Schluessel selbst
  ergebnis.brevo_schluessel_art = key.startsWith("xkeysib-") ? "API-Schluessel" : key.startsWith("xsmtpsib-") ? "SMTP-Schluessel (fuer die API ungeeignet)" : "unbekanntes Format";
  const h = { "api-key": key, Accept: "application/json" };
  try {
    const konto = await fetch("https://api.brevo.com/v3/account", { headers: h });
    ergebnis.brevo_konto_http = konto.status;
    if (konto.ok) {
      const k = await konto.json();
      ergebnis.brevo_tarif = (k.plan ?? []).map((p: { type?: string; credits?: number; creditsType?: string }) => ({ typ: p.type, guthaben: p.credits, art: p.creditsType }));
    } else {
      // Nur Brevo-Fehlercode + kurzer Text (enthaelt keine Schluessel), z. B. "Key not found" oder "unrecognised IP address"
      const f = await konto.json().catch(() => ({}));
      ergebnis.brevo_fehler = { code: f.code ?? null, text: typeof f.message === "string" ? f.message.slice(0, 200) : null };
    }
    const absender = await fetch("https://api.brevo.com/v3/senders", { headers: h });
    ergebnis.brevo_absender_http = absender.status;
    if (absender.ok) {
      const s = await absender.json();
      ergebnis.brevo_absender = (s.senders ?? []).map((x: { email: string; active: boolean }) => ({ email: x.email, aktiv: x.active }));
    } else await absender.body?.cancel();
    const domains = await fetch("https://api.brevo.com/v3/senders/domains", { headers: h });
    ergebnis.brevo_domains_http = domains.status;
    if (domains.ok) {
      const d = await domains.json();
      ergebnis.brevo_domains = (d.domains ?? []).map((x: { domain_name: string; authenticated: boolean; verified: boolean }) => ({ domain: x.domain_name, authentifiziert: x.authenticated, verifiziert: x.verified }));
    } else await domains.body?.cancel();
    // Probeversand im Brevo-Sandbox-Modus: wird vollstaendig geprueft, aber NICHT zugestellt
    const probe = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: ABSENDER,
        to: [{ email: "info@tanzraum.app" }],
        subject: "TanzRaum Selbsttest (Sandbox, wird nicht zugestellt)",
        htmlContent: "<p>Selbsttest</p>",
        headers: { "X-Sib-Sandbox": "drop" },
      }),
    });
    ergebnis.probeversand_noreply_http = probe.status;
    ergebnis.probeversand_noreply_ok = probe.ok;
    if (probe.ok) await probe.body?.cancel();
    else {
      const f = await probe.json().catch(() => ({}));
      ergebnis.probeversand_fehler = { code: f.code ?? null, text: typeof f.message === "string" ? f.message.slice(0, 200) : null };
    }
  } catch {
    ergebnis.brevo_erreichbar = false;
  }
  return ergebnis;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.has("logo")) {
    return new Response(b64ToBytes(LOGO_PNG_BASE64), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800", "Access-Control-Allow-Origin": "*" },
    });
  }
  if (req.method !== "POST") return json({ error: "Nicht erlaubt" }, 405);

  const body = await req.text();

  // --- Selbsttest (nur Server, per Vault-Geheimnis) ---
  const testGeheimnis = req.headers.get("x-tanzraum-geheimnis");
  if (testGeheimnis) {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceSchluessel(), { auth: { persistSession: false } });
    const { data: ok } = await admin.rpc("server_geheimnis_gueltig", { p_geheimnis: testGeheimnis });
    if (ok !== true) return json({ error: "Nicht berechtigt" }, 403);
    return json(await selbsttest());
  }

  // --- Send Email Hook ---
  if (!(await signaturGueltig(req, body))) {
    console.warn("[auth-email] ungueltige oder fehlende Hook-Signatur");
    return json({ error: { http_code: 401, message: "Nicht berechtigt" } }, 401);
  }

  let daten: HookDaten;
  try {
    daten = JSON.parse(body);
  } catch {
    return hookFehler("Ungültige Anfrage");
  }
  const art = daten.email_data?.email_action_type ?? "";
  const vorname = typeof daten.user?.user_metadata?.vorname === "string" ? (daten.user.user_metadata.vorname as string) : null;
  const { basis, pfad } = zielBasis(daten.email_data ?? ({} as HookDaten["email_data"]));
  const ed = daten.email_data;

  const auftraege: { an: string; mail: V.Mail }[] = [];
  switch (art) {
    case "signup":
      if (ed.token_hash && daten.user.email) auftraege.push({ an: daten.user.email, mail: V.registrierung({ vorname, link: bestaetigungsLink(basis, ed.token_hash, art, pfad) }) });
      break;
    case "recovery":
      if (ed.token_hash && daten.user.email) auftraege.push({ an: daten.user.email, mail: V.passwortZuruecksetzen({ vorname, link: bestaetigungsLink(basis, ed.token_hash, art, pfad) }) });
      break;
    case "magiclink":
    case "email":
      if (ed.token_hash && daten.user.email) auftraege.push({ an: daten.user.email, mail: V.anmeldelink({ vorname, link: bestaetigungsLink(basis, ed.token_hash, art, pfad) }) });
      break;
    case "invite":
      if (ed.token_hash && daten.user.email) auftraege.push({ an: daten.user.email, mail: V.kontoEinladung({ link: bestaetigungsLink(basis, ed.token_hash, art, pfad) }) });
      break;
    case "email_change": {
      const neu = daten.user.new_email;
      if (!neu) break;
      // Sichere E-Mail-Aenderung: bisherige Adresse erhaelt token_hash_new, neue Adresse token_hash (Supabase-Konvention).
      // Beide Links muessen geklickt werden; ohne "Secure email change" gibt es nur die Mail an die neue Adresse.
      if (ed.token_hash && ed.token_hash_new && daten.user.email) {
        auftraege.push({ an: daten.user.email, mail: V.emailAendernAlt({ vorname, neueEmail: neu, link: bestaetigungsLink(basis, ed.token_hash_new, art, pfad) }) });
        auftraege.push({ an: neu, mail: V.emailAendernNeu({ vorname, neueEmail: neu, link: bestaetigungsLink(basis, ed.token_hash, art, pfad) }) });
      } else {
        const hash = ed.token_hash || ed.token_hash_new;
        if (hash) auftraege.push({ an: neu, mail: V.emailAendernNeu({ vorname, neueEmail: neu, link: bestaetigungsLink(basis, hash, art, pfad) }) });
      }
      break;
    }
    case "reauthentication":
      if (ed.token && daten.user.email) auftraege.push({ an: daten.user.email, mail: V.sicherheitscode({ vorname, code: ed.token }) });
      break;
    default: {
      const ziel = art === "email_changed_notification" ? (ed.old_email || daten.user.email) : daten.user.email;
      const mail = V.sicherheitsmeldung({ art, vorname, loginUrl: `${basis}/login` });
      if (mail && ziel) auftraege.push({ an: ziel, mail });
      else {
        console.warn(`[auth-email] unbekannte Art: ${art}`);
        return hookFehler("Diese E-Mail-Art wird nicht unterstützt.");
      }
    }
  }

  if (auftraege.length === 0 || auftraege.some((a) => !istEmail(a.an))) return hookFehler("Die E-Mail konnte nicht erstellt werden.");

  for (const a of auftraege) {
    const r = await sendeMail({ art: `auth-${art}`, an: [{ email: a.an }], betreff: a.mail.betreff, html: a.mail.html });
    if (!r.ok) return hookFehler("Die E-Mail konnte momentan nicht versendet werden. Bitte versuche es später erneut.");
  }
  return json({});
});
