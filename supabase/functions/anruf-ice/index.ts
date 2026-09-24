// Supabase Edge Function: anruf-ice
// Liefert angemeldeten Nutzern die ICE-Server fuer Sprach-/Videoanrufe (WebRTC).
// Ohne weitere Konfiguration nur STUN (funktioniert in den meisten WLANs). Fuer zuverlaessige Anrufe
// ueber Mobilfunk und Firmennetze wird ein TURN-Relay benoetigt, konfigurierbar per Secrets:
//   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN  (kurzlebige Zugangsdaten je Anruf)
//   oder TURN_URLS (kommagetrennt) + TURN_USERNAME + TURN_CREDENTIAL

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STUN = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const antwort = (daten: unknown, status = 200) =>
    new Response(JSON.stringify(daten), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

  const auth = req.headers.get("Authorization");
  if (!auth) return antwort({ error: "Nicht angemeldet" }, 401);
  const nutzer = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data } = await nutzer.auth.getUser();
  if (!data.user) return antwort({ error: "Nicht angemeldet" }, 401);

  const cfId = Deno.env.get("CLOUDFLARE_TURN_KEY_ID");
  const cfToken = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN");
  if (cfId && cfToken) {
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${cfId}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 4 * 3600 }),
      });
      if (r.ok) {
        const j = await r.json();
        return antwort({ iceServers: j.iceServers, relay: true });
      }
      console.warn("[anruf-ice] Cloudflare", r.status);
    } catch (e) {
      console.warn("[anruf-ice]", e);
    }
  }

  const urls = (Deno.env.get("TURN_URLS") ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  if (urls.length) {
    return antwort({
      iceServers: [...STUN, { urls, username: Deno.env.get("TURN_USERNAME") ?? "", credential: Deno.env.get("TURN_CREDENTIAL") ?? "" }],
      relay: true,
    });
  }
  return antwort({ iceServers: STUN, relay: false });
});
