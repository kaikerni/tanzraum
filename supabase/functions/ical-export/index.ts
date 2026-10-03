// Supabase Edge Function: ical-export
// Read-only Kalender-Abo (Google, Apple, Outlook, andere iCal-Apps) per persoenlichem, nicht erratbarem Token.
//   ?token=...                 -> eigene Trainings, Vereinstermine, private Termine
//   ?token=...&inhalt=turniere -> alle zentralen TanzRaum-Turniere
// Welche Eintraege jemand sieht, entscheidet ausschliesslich die DB-Funktion ical_feed (gleiche Regeln wie in der App).

import { createClient } from "jsr:@supabase/supabase-js@2";

type Eintrag = {
  uid: string;
  titel: string;
  ort: string | null;
  beschreibung: string | null;
  beginn: string | null;
  ende: string | null;
  ganztags: boolean;
  start_datum: string;
  end_datum: string;
  kalender_name: string;
};

const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

function utc(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function tag(datum: string) {
  return datum.replace(/-/g, "");
}
function text(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// RFC 5545: Zeilen nach 75 Oktetten falten.
function falten(zeile: string) {
  const bytes = new TextEncoder().encode(zeile);
  if (bytes.length <= 75) return zeile;
  const teile: string[] = [];
  let aktuell = "";
  let laenge = 0;
  for (const zeichen of zeile) {
    const l = new TextEncoder().encode(zeichen).length;
    if (laenge + l > (teile.length === 0 ? 75 : 74)) {
      teile.push(aktuell);
      aktuell = "";
      laenge = 0;
    }
    aktuell += zeichen;
    laenge += l;
  }
  teile.push(aktuell);
  return teile.join("\r\n ");
}

function baueIcs(name: string, eintraege: Eintrag[]) {
  const jetzt = utc(new Date().toISOString());
  const z = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TanzRaum//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + text(name),
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of eintraege) {
    z.push("BEGIN:VEVENT", "UID:" + e.uid, "DTSTAMP:" + jetzt);
    if (e.ganztags || !e.beginn) {
      z.push("DTSTART;VALUE=DATE:" + tag(e.start_datum), "DTEND;VALUE=DATE:" + tag(e.end_datum));
    } else {
      z.push("DTSTART:" + utc(e.beginn), "DTEND:" + utc(e.ende ?? e.beginn));
    }
    z.push("SUMMARY:" + text(e.titel));
    if (e.ort) z.push("LOCATION:" + text(e.ort));
    if (e.beschreibung) z.push("DESCRIPTION:" + text(e.beschreibung));
    z.push("END:VEVENT");
  }
  z.push("END:VCALENDAR");
  return z.map(falten).join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const inhalt = url.searchParams.get("inhalt") === "turniere" ? "turniere" : "persoenlich";
  if (!TOKEN.test(token)) return new Response("Ungültiger Link", { status: 404 });

  try {
    const schluessel = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, schluessel["default"], {
      auth: { persistSession: false },
    });
    const { data, error } = await admin.rpc("ical_feed", { p_token: token, p_inhalt: inhalt });
    if (error) throw error;
    const eintraege = (data ?? []) as Eintrag[];
    const name = eintraege[0]?.kalender_name ?? (inhalt === "turniere" ? "TanzRaum Turniere" : "TanzRaum");
    return new Response(baueIcs(name, eintraege), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${inhalt === "turniere" ? "tanzraum-turniere" : "tanzraum"}.ics"`,
        "Cache-Control": "private, max-age=900",
      },
    });
  } catch (e) {
    console.error("[ical-export]", e);
    return new Response("Der Kalender ist gerade nicht erreichbar.", { status: 500 });
  }
});
