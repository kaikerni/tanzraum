// Supabase Edge Function: anruf-ice
// Liefert die ICE-Server fuer einen konkreten Sprach-/Videoanruf im TanzRaum-Messenger.
//
//   POST { anruf_id }  (Authorization: Bearer <Nutzer-JWT>)
//     -> nur Beteiligte eines klingelnden/aktiven Anrufs (DB: anruf_ice_berechtigt)
//     -> { iceServers, relay }  mit kurzlebigen, pro Anruf erzeugten Cloudflare-TURN-Zugangsdaten
//
//   POST { selbsttest: true }  (Header x-tanzraum-geheimnis, nur Server/pg_net)
//     -> Diagnose OHNE Zugangsdaten (ob Cloudflare erreichbar ist und welche Protokolle geliefert werden)
//
// Direkte Verbindungen bleiben bevorzugt: Der Browser probiert immer zuerst direkte Wege (host/STUN);
// TURN wird nur genutzt, wenn keine direkte Verbindung zustande kommt (iceTransportPolicy "all").
//
// Secrets (nur serverseitig): CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
// optional statt Cloudflare: TURN_URLS (kommagetrennt), TURN_USERNAME, TURN_CREDENTIAL
// Es werden niemals Secrets oder Zugangsdaten geloggt.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


// So lange darf ein Anruf hoechstens dauern (danach wird er serverseitig beendet) -> Gueltigkeit der TURN-Daten
const GUELTIGKEIT_SEKUNDEN = 4 * 3600;

type IceServer = { urls: string | string[]; username?: string; credential?: string };

const STUN: IceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

function antwort(daten: unknown, status = 200) {
  return new Response(JSON.stringify(daten), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

// Browser blockieren Port 53; Cloudflare liefert solche Adressen mit -> herausfiltern (laut Cloudflare-Empfehlung)
function ohnePort53(server: IceServer[]): IceServer[] {
  return server
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0);
}

async function cloudflareTurn(): Promise<{ server: IceServer[] | null; status: number | null }> {
  // trim(): versehentliche Leerzeichen/Zeilenumbrueche beim Einfuegen der Secrets abfangen
  const id = Deno.env.get("CLOUDFLARE_TURN_KEY_ID")?.trim();
  const token = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN")?.trim();
  if (!id || !token) return { server: null, status: null };
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: GUELTIGKEIT_SEKUNDEN }),
    });
    if (!r.ok) {
      console.warn("[anruf-ice] Cloudflare-TURN nicht verfuegbar, HTTP", r.status);
      return { server: null, status: r.status };
    }
    const j = await r.json();
    const liste: IceServer[] = Array.isArray(j.iceServers) ? j.iceServers : j.iceServers ? [j.iceServers] : [];
    // Nur Eintraege mit TURN uebernehmen; STUN kommt aus der eigenen Liste
    const turn = ohnePort53(liste)
      .map((s) => ({ ...s, urls: (s.urls as string[]).filter((u) => u.startsWith("turn")) }))
      .filter((s) => s.urls.length > 0 && s.username && s.credential);
    return { server: turn, status: r.status };
  } catch {
    console.warn("[anruf-ice] Cloudflare-TURN nicht erreichbar");
    return { server: null, status: 0 };
  }
}

function eigenerTurn(): IceServer[] | null {
  const urls = (Deno.env.get("TURN_URLS") ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return null;
  return [{ urls, username: Deno.env.get("TURN_USERNAME") ?? "", credential: Deno.env.get("TURN_CREDENTIAL") ?? "" }];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwort({ error: "Nur POST" }, 405);

  let body: { anruf_id?: unknown; selbsttest?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return antwort({ error: "Ungültige Anfrage" }, 400);
  }
  const url = Deno.env.get("SUPABASE_URL")!;

  // ---- Server-Selbsttest (liefert nie Zugangsdaten) ----
  if (body.selbsttest === true) {
    const geheimnis = req.headers.get("x-tanzraum-geheimnis");
    const schluessel = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);
    const admin = createClient(url, schluessel["default"], { auth: { persistSession: false } });
    const { data: ok } = await admin.rpc("server_geheimnis_gueltig", { p_geheimnis: geheimnis });
    if (ok !== true) return antwort({ error: "Nicht berechtigt" }, 403);
    const { server, status } = await cloudflareTurn();
    const alle = (server ?? []).flatMap((s) => s.urls as string[]);
    const rohId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID") ?? "";
    const rohToken = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN") ?? "";
    return antwort({
      // nur Formatangaben, nie die Werte selbst
      key_id_laenge: rohId.trim().length,
      key_id_format_hex32: /^[0-9a-f]{32}$/i.test(rohId.trim()),
      key_id_mit_leerzeichen: rohId !== rohId.trim(),
      token_laenge: rohToken.trim().length,
      token_mit_leerzeichen: rohToken !== rohToken.trim(),
      cloudflare_konfiguriert: Boolean(Deno.env.get("CLOUDFLARE_TURN_KEY_ID") && Deno.env.get("CLOUDFLARE_TURN_API_TOKEN")),
      cloudflare_http_status: status,
      turn_zugangsdaten_erzeugt: Boolean(server && server.length > 0),
      turn_adressen: alle.length,
      turn_udp: alle.some((u) => u.startsWith("turn:") && !u.includes("transport=tcp")),
      turn_tcp: alle.some((u) => u.startsWith("turn:") && u.includes("transport=tcp")),
      turns_tls: alle.some((u) => u.startsWith("turns:")),
      port_53_entfernt: !alle.some((u) => /:53(\?|$)/.test(u)),
      gueltigkeit_sekunden: GUELTIGKEIT_SEKUNDEN,
      eigener_turn_konfiguriert: eigenerTurn() !== null,
    });
  }

  // ---- Normaler Abruf fuer einen Anruf ----
  const auth = req.headers.get("Authorization");
  if (!auth) return antwort({ error: "Nicht angemeldet" }, 401);
  const nutzer = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: anmeldung } = await nutzer.auth.getUser();
  if (!anmeldung.user) return antwort({ error: "Nicht angemeldet" }, 401);

  const anrufId = typeof body.anruf_id === "string" ? body.anruf_id : "";
  if (!/^[0-9a-f-]{36}$/.test(anrufId)) return antwort({ error: "Anruf fehlt" }, 400);
  const { data: berechtigt } = await nutzer.rpc("anruf_ice_berechtigt", { p_anruf_id: anrufId });
  if (berechtigt !== true) return antwort({ error: "Kein laufender Anruf" }, 403);

  const { server: cloudflare } = await cloudflareTurn();
  const turn = cloudflare && cloudflare.length ? cloudflare : eigenerTurn();
  return antwort({ iceServers: [...STUN, ...(turn ?? [])], relay: Boolean(turn && turn.length) });
});
