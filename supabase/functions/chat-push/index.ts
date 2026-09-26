// Supabase Edge Function: chat-push
// GET  -> { publicKey } (oeffentlicher VAPID-Schluessel zum Abonnieren im Browser)
// POST -> { nachricht_id } bzw. { anruf_id } bzw. { admin_push: true } (neuer Kauf) vom Datenbank-Trigger (Header x-tanzraum-geheimnis). Empfaenger bestimmt
//         ausschliesslich die DB-Funktion chat_push_ziele (gleiche Zugriffsregeln wie die App, ohne Absender,
//         ohne Stummschaltung). Gesendet wird ein Push OHNE Inhalt; der Service Worker holt Titel/Text
//         anschliessend angemeldet ueber /api/chat/push-info.
// VAPID: gueltiges Paar aus VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY, sonst aus dem Vault; fehlt beides, wird
// einmalig ein Paar erzeugt und verschluesselt im Vault abgelegt (der private Schluessel verlaesst nie den Server).

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function vapidHeader(endpoint: string, oeffentlich: string, privat: string): Promise<string> {
  const pub = base64urlToBytes(oeffentlich);
  const schluessel = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: bytesToBase64url(pub.slice(1, 33)), y: bytesToBase64url(pub.slice(33, 65)), d: bytesToBase64url(base64urlToBytes(privat)), ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const url = new URL(endpoint);
  const kopf = bytesToBase64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const inhalt = bytesToBase64url(
    new TextEncoder().encode(JSON.stringify({ aud: `${url.protocol}//${url.host}`, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:info@tanzraum.app" })),
  );
  const signatur = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, schluessel, new TextEncoder().encode(`${kopf}.${inhalt}`));
  return `vapid t=${kopf}.${inhalt}.${bytesToBase64url(new Uint8Array(signatur))}, k=${oeffentlich}`;
}

type Paar = { oeffentlich: string; privat: string };

function gueltig(p: Partial<Paar> | null | undefined): p is Paar {
  try {
    return !!p?.oeffentlich && !!p?.privat && base64urlToBytes(p.oeffentlich).length === 65 && base64urlToBytes(p.privat).length === 32;
  } catch {
    return false;
  }
}

// deno-lint-ignore no-explicit-any
async function vapidPaar(admin: any): Promise<Paar | null> {
  const env = { oeffentlich: Deno.env.get("VAPID_PUBLIC_KEY") ?? "", privat: Deno.env.get("VAPID_PRIVATE_KEY") ?? "" };
  if (gueltig(env)) return env;
  const { data } = await admin.rpc("push_vapid_holen");
  if (gueltig(data?.[0])) return data[0];
  const neu = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", neu.privateKey);
  const x = base64urlToBytes(jwk.x!);
  const y = base64urlToBytes(jwk.y!);
  const pub = new Uint8Array(65);
  pub[0] = 4;
  pub.set(x, 1);
  pub.set(y, 33);
  const { data: gespeichert } = await admin.rpc("push_vapid_speichern", { p_oeffentlich: bytesToBase64url(pub), p_privat: jwk.d });
  return gueltig(gespeichert?.[0]) ? gespeichert[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const schluessel = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, schluessel["default"], { auth: { persistSession: false } });

  if (req.method === "GET") {
    const paar = await vapidPaar(admin);
    return new Response(JSON.stringify({ publicKey: paar?.oeffentlich ?? null }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const geheimnis = req.headers.get("x-tanzraum-geheimnis");
    const { nachricht_id, anruf_id, admin_push } = await req.json();
    if (!geheimnis || (typeof nachricht_id !== "string" && typeof anruf_id !== "string" && admin_push !== true)) return new Response("Ungültige Anfrage", { status: 400 });
    const paar = await vapidPaar(admin);
    if (!paar) return new Response(JSON.stringify({ ok: false, grund: "VAPID fehlt" }), { status: 200 });
    const { oeffentlich, privat } = paar;
    const { data: ziele, error } =
      admin_push === true
        ? await admin.rpc("admin_push_ziele", { p_geheimnis: geheimnis })
        : typeof anruf_id === "string"
        ? await admin.rpc("anruf_push_ziele", { p_geheimnis: geheimnis, p_anruf_id: anruf_id })
        : await admin.rpc("chat_push_ziele", { p_geheimnis: geheimnis, p_nachricht_id: nachricht_id });
    if (error) return new Response("Nicht berechtigt", { status: 403 });

    let gesendet = 0;
    const abgelaufen: string[] = [];
    for (const z of (ziele ?? []) as { abo_id: string; endpoint: string }[]) {
      try {
        const antwort = await fetch(z.endpoint, {
          method: "POST",
          headers: { Authorization: await vapidHeader(z.endpoint, oeffentlich, privat), TTL: "86400", Urgency: "high", "Content-Length": "0" },
        });
        if (antwort.status === 404 || antwort.status === 410) abgelaufen.push(z.abo_id);
        else if (antwort.ok) gesendet++;
        else console.warn("[chat-push]", antwort.status, await antwort.text());
      } catch (e) {
        console.warn("[chat-push] Endpoint", e);
      }
    }
    if (abgelaufen.length) await admin.from("push_subscriptions").delete().in("id", abgelaufen);
    return new Response(JSON.stringify({ ok: true, gesendet, abgelaufen: abgelaufen.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[chat-push]", e);
    return new Response("Fehler", { status: 500 });
  }
});
