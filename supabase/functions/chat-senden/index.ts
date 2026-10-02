// Supabase Edge Function: chat-senden – TanzRaum Schutzpruefung VOR der Veroeffentlichung
//
// Einziger Weg, Nachrichten in den oeffentlichen TanzRaum Chat und in Vereins-, Tanzgruppen- und eigene Gruppenchats
// zu schreiben (direktes Einfuegen ist per RLS gesperrt). Ablauf:
//   1. Anmeldung pruefen (Nutzer-JWT)
//   2. schutz_vorpruefung (als Nutzer): Schreibrecht, Schreibsperre, Flut, Wiederholung, Kontext
//   3. feste Schutzregeln; externe KI-Pruefung NUR wenn CHAT_AI_MODERATION_ENABLED=true (Standard: AUS – dann wird keine
//      Nachricht an einen KI-Anbieter uebertragen und kein Schluessel benoetigt)
//   4. nur bei Freigabe: schutz_veroeffentlichen (Service) -> Speicherung -> Realtime an die anderen Nutzer
//   Blockiert/auffaellig/(eingeschaltete) KI nicht erreichbar: nichts wird gespeichert oder verteilt; der Absender bekommt eine neutrale Meldung.
//
// POST { gespraech_id, art: "neu" | "bearbeiten", nachricht_id?, nachricht: { inhalt, antwort_auf, bild_pfad, anhang, umfrage, standort, sticker } }
// POST { nur_status: true } -> { ok: true, ki_aktiv } (nur der Schalter, keine Daten; fuer die Anzeige in der Moderation)
//
// Server-Konfiguration (nur Supabase-Secrets, nie im Browser, nie im Repository, nie in Logs):
//   CHAT_AI_MODERATION_ENABLED – externe KI-Pruefung nur bei genau "true". Fehlt der Wert: AUS (Standard).
//   ANTHROPIC_API_KEY          – wird nur gelesen, wenn die KI-Pruefung eingeschaltet ist; schaltet sie selbst NICHT ein.
//   SCHUTZ_KI_MODELL           – optional (Standard claude-haiku-4-5-20251001).
// TODO (rechtlich): Externe KI erst nach separater datenschutzrechtlicher Pruefung und Freigabe aktivieren –
// siehe docs/chat-schutzpruefung.md („Rechtliche Prüfung vor Aktivierung externer KI“).

import { CORS, json } from "../_shared/mail.ts";
import { angemeldet, dienst, UUID } from "../_shared/zugriff.ts";
import { kiAktiviert, kiPruefen, pruefeUndVeroeffentliche, TEXTE, type Nachricht, type Vorpruefung } from "../_shared/schutzpruefung.ts";

// Standard: externe KI AUS. Nur eine bewusste Server-Konfiguration schaltet sie ein.
const KI_AKTIV = kiAktiviert(Deno.env.get("CHAT_AI_MODERATION_ENABLED"));
const MODELL = Deno.env.get("SCHUTZ_KI_MODELL") || "claude-haiku-4-5-20251001";

function uhrzeit(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Nur bekannte Felder in erwarteter Form uebernehmen
function bereinigen(n: unknown): Nachricht | null {
  if (!n || typeof n !== "object") return null;
  const x = n as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const objekt = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const umfrage = objekt(x.umfrage);
  const anhang = objekt(x.anhang);
  const standort = objekt(x.standort);
  return {
    inhalt: text(x.inhalt, 4000) ?? "",
    antwort_auf: typeof x.antwort_auf === "string" && UUID.test(x.antwort_auf) ? x.antwort_auf : null,
    bild_pfad: text(x.bild_pfad, 300) ?? null,
    sticker: text(x.sticker, 40) ?? null,
    anhang: anhang ? { art: text(anhang.art, 20), pfad: text(anhang.pfad, 300), name: text(anhang.name, 200), dauer: typeof anhang.dauer === "number" ? anhang.dauer : undefined } : null,
    umfrage: umfrage
      ? { frage: text(umfrage.frage, 300), optionen: Array.isArray(umfrage.optionen) ? umfrage.optionen.slice(0, 12).map((o) => String(o).slice(0, 100)) : [], mehrfach: umfrage.mehrfach === true }
      : null,
    standort: standort && typeof standort.lat === "number" && typeof standort.lng === "number"
      ? { lat: standort.lat, lng: standort.lng, genauigkeit: typeof standort.genauigkeit === "number" ? standort.genauigkeit : undefined }
      : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, fehler: "Nicht erlaubt" }, 405);

  const sitzung = await angemeldet(req);
  if (!sitzung) return json({ ok: false, code: "keine_rechte", fehler: "Bitte melde dich an." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: "ungueltig", fehler: "Ungültige Anfrage." }, 400);
  }
  if (body.nur_status === true) return json({ ok: true, ki_aktiv: KI_AKTIV });
  const gespraechId = body.gespraech_id;
  const art = body.art === "bearbeiten" ? "bearbeiten" : "neu";
  const nachrichtId = typeof body.nachricht_id === "string" && UUID.test(body.nachricht_id) ? body.nachricht_id : null;
  const nachricht = bereinigen(body.nachricht);
  if (typeof gespraechId !== "string" || !UUID.test(gespraechId) || !nachricht || (art === "bearbeiten" && !nachrichtId)) {
    return json({ ok: false, code: "ungueltig", fehler: "Ungültige Anfrage." }, 400);
  }

  const service = dienst();
  // Schluessel nur lesen, wenn die externe KI ausdruecklich eingeschaltet ist
  const apiKey = KI_AKTIV ? Deno.env.get("ANTHROPIC_API_KEY") ?? "" : "";

  try {
    const ergebnis = await pruefeUndVeroeffentliche(nachricht, {
      vorpruefung: async (text) => {
        const { data, error } = await sitzung.nutzer.rpc("schutz_vorpruefung", { p_gespraech_id: gespraechId, p_art: art, p_nachricht_id: nachrichtId, p_text: text });
        if (error) return { ok: false, grund: "keine_rechte" };
        return data as Vorpruefung;
      },
      ki: KI_AKTIV ? (text, k, hinweis) => kiPruefen(text, k, hinweis, { apiKey, modell: MODELL, timeoutMs: 7000, fetch }) : null,
      blockieren: async (e) => {
        const { error } = await service.rpc("schutz_blockieren", {
          p_user_id: sitzung.userId, p_gespraech_id: gespraechId, p_quelle: e.quelle, p_ergebnis: e.ergebnis,
          p_kategorie: e.kategorie, p_schwere: e.schwere, p_text_hash: e.hash || null, p_auszug: e.auszug || null,
        });
        // Protokollfehler veroeffentlichen trotzdem nichts – nur fuer die Fehlersuche (ohne Inhalte)
        if (error) console.error("schutz_blockieren fehlgeschlagen", error.code);
      },
      veroeffentlichen: async () => {
        const { data, error } = await service.rpc("schutz_veroeffentlichen", {
          p_user_id: sitzung.userId, p_gespraech_id: gespraechId, p_art: art, p_nachricht_id: nachrichtId, p_nachricht: nachricht,
        });
        if (error) throw new Error(error.message);
        return data as string;
      },
    });
    if (!ergebnis.ok && ergebnis.code === "gesperrt" && ergebnis.bis) {
      return json({ ...ergebnis, fehler: `${TEXTE.gesperrt} Wieder möglich ab ${uhrzeit(ergebnis.bis)} Uhr.` });
    }
    return json(ergebnis);
  } catch (e) {
    // z. B. Schreibrecht beim Speichern entfallen – nichts wurde veroeffentlicht
    const text = e instanceof Error && /nur Text|zu lang|ungültig|leer|nicht schreiben/i.test(e.message) ? e.message : "Die Nachricht konnte nicht gesendet werden.";
    return json({ ok: false, code: "fehler", fehler: text });
  }
});
