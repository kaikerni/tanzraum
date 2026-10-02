// Tests der TanzRaum Schutzpruefung (Regeln + Ablauf), ohne Netz:
//   node --experimental-strip-types supabase/functions/_shared/schutzpruefung_test.ts   (oder: deno run schutzpruefung_test.ts)
import assert from "node:assert/strict";
import { pruefeRegeln, pruefeUndVeroeffentliche, kiPruefen, type PruefKontext, type KiErgebnis } from "./schutzpruefung.ts";

const OEFF: PruefKontext = { oeffentlich: true, minderjaehrige: true, kontextEigene: [], kontextChat: [] };
const GRUPPE_ERW: PruefKontext = { oeffentlich: false, minderjaehrige: false, kontextEigene: [], kontextChat: [] };
let fehler = 0;
function fall(name: string, f: () => void | Promise<void>) {
  return Promise.resolve().then(f).then(() => console.log(`✔ ${name}`), (e) => { fehler++; console.log(`✘ ${name}: ${e?.message ?? e}`); });
}
const regel = (t: string, k = OEFF) => pruefeRegeln(t, k);

// 1) harmlos – auch mit Tanzsport-Begriffen
for (const t of ["Wer ist morgen beim Turnier?", "Viel Erfolg an alle! 😄", "Training morgen 18:00 – 19:30 Uhr", "Die Hebefigur war mega, geiler Auftritt!",
  "Starterliste kommt am 12.10.2026", "Mariechen-Spagat üben wir heute", "Ich muss die App installieren", "Wer hat ein Kostüm in 152?", "Super!!! Glückwunsch zum 1. Platz",
  "Snapshot vom Training sieht gut aus", "Die Saison 2026/27 wird spannend"]) {
  await fall(`frei: „${t}“`, () => assert.equal(regel(t).entscheidung, "frei", JSON.stringify(regel(t))));
}
// 2) blockiert
const BLOCK: [string, string][] = [
  ["Du Hurensohn", "beleidigung"], ["du h u r e n s o h n", "beleidigung"], ["Du Hur3ns0hn!!", "beleidigung"], ["huuuurensohnnn", "beleidigung"], ["fick dich!", "beleidigung"],
  ["Ich bring dich um", "drohung"], ["ich weiß wo du wohnst", "drohung"],
  ["Ruf mich an: 0171 2345678", "kontaktdaten"], ["+49 (171) 234-56-78", "kontaktdaten"], ["null eins sieben eins zwei drei vier fünf sechs", "kontaktdaten"],
  ["schreib an lisa.m (at) gmx [dot] de", "kontaktdaten"], ["Ich wohne in der Hauptstraße 12", "kontaktdaten"],
  ["Hast du Snap? Schreib mir", "messenger_wechsel"], ["Hast du Insta?", "messenger_wechsel"], ["adde mich auf insta", "messenger_wechsel"], ["gib mir deine nummer", "messenger_wechsel"],
  ["schick mir nudes", "sexuell"], ["n.u.d.e.s bitte", "sexuell"], ["Kanake", "diskriminierung"],
  ["Gewinnspiel! Klick hier: http://gratis-geld.xyz", "spam"], ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "spam"],
];
for (const [t, k] of BLOCK) {
  await fall(`blockiert (${k}): „${t}“`, () => { const r = regel(t); assert.equal(r.entscheidung, "blockiert", JSON.stringify(r)); assert.equal(r.kategorie, k, JSON.stringify(r)); });
}
// 3) Verdacht -> KI entscheidet (nicht automatisch blockiert)
for (const t of ["Du Idiot 😂", "Das Video ist auf Instagram", "wie alt bist du?"]) {
  await fall(`Verdacht: „${t}“`, () => assert.equal(regel(t).entscheidung, "verdacht", JSON.stringify(regel(t))));
}
// 4) Kombination mehrerer Nachrichten (Grooming)
await fall("Kombination: „wie alt bist du“ + „bist du allein?“ -> grooming blockiert", () => {
  const r = pruefeRegeln("bist du allein?", { ...OEFF, kontextEigene: ["hey", "wie alt bist du?"] });
  assert.equal(r.entscheidung, "blockiert"); assert.equal(r.kategorie, "grooming"); assert.equal(r.schwere, 3);
});
await fall("Kombination: Kompliment + Treffen -> blockiert", () => {
  const r = pruefeRegeln("lass uns mal treffen", { ...OEFF, kontextEigene: ["du bist so hübsch"] });
  assert.equal(r.entscheidung, "blockiert");
});
// 5) Gruppenchat ohne Minderjaehrige: Hallenadresse ist Organisation -> KI entscheidet
await fall("Gruppe (Erwachsene): Hallenadresse -> Verdacht statt Block", () => assert.equal(pruefeRegeln("Training heute in der Schulstraße 12", GRUPPE_ERW).entscheidung, "verdacht"));
await fall("Gruppe mit Minderjährigen: Telefonnummer -> blockiert", () => assert.equal(pruefeRegeln("meine nummer 0171 2345678", { ...GRUPPE_ERW, minderjaehrige: true }).entscheidung, "blockiert"));
await fall("Öffentlich: fremder Link -> blockiert, tanzraum.app erlaubt", () => {
  assert.equal(regel("schaut mal www.beispiel.de").entscheidung, "blockiert");
  assert.equal(regel("Infos unter https://tanzraum.app/workshops").entscheidung, "frei");
});

// ---------------- Ablauf ----------------
type Log = { blockiert: unknown[]; veroeffentlicht: number; kiAufrufe: number };
function deps(o: { vp?: Record<string, unknown>; ki?: (t: string) => Promise<KiErgebnis> }, log: Log) {
  return {
    vorpruefung: async () => ({ ok: true, oeffentlich: true, minderjaehrige: true, max_laenge: 1000, kontext_eigene: [], kontext_chat: [], ...(o.vp ?? {}) }),
    ki: async (t: string) => { log.kiAufrufe++; return o.ki ? o.ki(t) : { entscheidung: "freigeben" as const, kategorie: "keine", schwere: 0 }; },
    blockieren: async (e: unknown) => { log.blockiert.push(e); return {}; },
    veroeffentlichen: async () => { log.veroeffentlicht++; return "neue-id"; },
  };
}
const neu = (): Log => ({ blockiert: [], veroeffentlicht: 0, kiAufrufe: 0 });

await fall("Ablauf 1: normale Nachricht -> Regeln + KI -> veröffentlicht", async () => {
  const l = neu(); const r = await pruefeUndVeroeffentliche({ inhalt: "Wer ist morgen beim Turnier?" }, deps({}, l));
  assert.deepEqual(r, { ok: true, id: "neue-id" }); assert.equal(l.kiAufrufe, 1); assert.equal(l.veroeffentlicht, 1);
});
await fall("Ablauf 2: Regelverstoß -> nicht veröffentlicht, keine KI, neutrale Meldung", async () => {
  const l = neu(); const r = await pruefeUndVeroeffentliche({ inhalt: "du Hurensohn" }, deps({}, l));
  assert.equal(r.ok, false); assert.equal((r as { fehler: string }).fehler, "Diese Nachricht konnte nicht veröffentlicht werden.");
  assert.equal(l.veroeffentlicht, 0); assert.equal(l.kiAufrufe, 0); assert.equal((l.blockiert[0] as { quelle: string }).quelle, "regel");
});
await fall("Ablauf 3: KI blockiert -> nicht veröffentlicht", async () => {
  const l = neu(); const r = await pruefeUndVeroeffentliche({ inhalt: "subtile Belästigung" }, deps({ ki: async () => ({ entscheidung: "blockieren", kategorie: "belaestigung", schwere: 2 }) }, l));
  assert.equal(r.ok, false); assert.equal(l.veroeffentlicht, 0); assert.equal((l.blockiert[0] as { quelle: string }).quelle, "ki");
});
await fall("Ablauf 4: KI „auffällig“ -> nicht veröffentlicht", async () => {
  const l = neu(); const r = await pruefeUndVeroeffentliche({ inhalt: "hmm" }, deps({ ki: async () => ({ entscheidung: "auffaellig", kategorie: "sonstiges", schwere: 1 }) }, l));
  assert.equal(r.ok, false); assert.equal(l.veroeffentlicht, 0);
});
await fall("Ablauf 5: KI nicht erreichbar -> NICHT veröffentlicht, Hinweis „nicht geprüft“", async () => {
  const l = neu(); const r = await pruefeUndVeroeffentliche({ inhalt: "Hallo zusammen" }, deps({ ki: async () => { throw new Error("ki_http_529"); } }, l));
  assert.equal(r.ok, false); assert.equal((r as { code: string }).code, "nicht_geprueft");
  assert.equal((r as { fehler: string }).fehler, "Deine Nachricht konnte gerade nicht geprüft werden. Bitte versuche es später erneut.");
  assert.equal(l.veroeffentlicht, 0); assert.equal((l.blockiert[0] as { ergebnis: string }).ergebnis, "nicht_geprueft");
});
await fall("Ablauf 6: Vorprüfung Flut/Duplikat/Sperre -> nicht veröffentlicht, keine KI", async () => {
  for (const grund of ["flut", "duplikat", "gesperrt", "keine_rechte"]) {
    const l = neu(); const r = await pruefeUndVeroeffentliche({ inhalt: "x" }, deps({ vp: { ok: false, grund } }, l));
    assert.equal(r.ok, false); assert.equal((r as { code: string }).code, grund); assert.equal(l.kiAufrufe + l.veroeffentlicht, 0);
  }
});
await fall("Ablauf 7: zu lang im öffentlichen Chat", async () => {
  const l = neu(); const r = await pruefeUndVeroeffentliche({ inhalt: "a b ".repeat(600) }, deps({}, l));
  assert.equal((r as { code: string }).code, "zu_lang"); assert.equal(l.veroeffentlicht, 0);
});
await fall("Ablauf 8: Sticker ohne Text -> ohne KI veröffentlicht (Flut/Sperre bereits geprüft)", async () => {
  const l = neu(); const r = await pruefeUndVeroeffentliche({ sticker: "t01" }, deps({}, l));
  assert.equal(r.ok, true); assert.equal(l.kiAufrufe, 0);
});
await fall("Ablauf 9: Umfrage-Text wird mitgeprüft", async () => {
  const l = neu(); const r = await pruefeUndVeroeffentliche({ inhalt: "", umfrage: { frage: "Wer kommt?", optionen: ["ja", "du Wichser"] } }, deps({}, l));
  assert.equal(r.ok, false); assert.equal(l.veroeffentlicht, 0);
});

// ---------------- KI-Aufruf ----------------
const antwort = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const KO = { apiKey: "test", modell: "claude-haiku-4-5-20251001", timeoutMs: 500 };
await fall("KI: gültige Antwort wird gelesen, nur Text + Kontext ohne Namen/IDs gesendet", async () => {
  let gesendet = "";
  const f = (async (_u: string, init: RequestInit) => { gesendet = String(init.body); return new Response(JSON.stringify({ content: [{ type: "text", text: '{"entscheidung":"freigeben","kategorie":"keine","schwere":0}' }] })); }) as unknown as typeof fetch;
  const r = await kiPruefen("Hallo", { ...OEFF, kontextEigene: ["vorher"] }, null, { ...KO, fetch: f });
  assert.equal(r.entscheidung, "freigeben");
  assert.ok(gesendet.includes("Hallo") && gesendet.includes("vorher") && !/user_id|sender|@|uuid/i.test(gesendet.replace(/"model":"[^"]+"/, "")), gesendet.slice(0, 200));
});
await fall("KI: HTTP-Fehler -> Ausnahme (fail closed)", async () => {
  await assert.rejects(kiPruefen("Hallo", OEFF, null, { ...KO, fetch: antwort({}, 529) as unknown as typeof fetch }));
});
await fall("KI: unklare Antwort -> Ausnahme (fail closed)", async () => {
  await assert.rejects(kiPruefen("Hallo", OEFF, null, { ...KO, fetch: antwort({ content: [{ type: "text", text: "Klingt okay" }] }) as unknown as typeof fetch }));
  await assert.rejects(kiPruefen("Hallo", OEFF, null, { ...KO, fetch: antwort({ content: [{ type: "text", text: '{"entscheidung":"vielleicht"}' }] }) as unknown as typeof fetch }));
});
await fall("KI: kein Schlüssel -> Ausnahme (fail closed)", async () => {
  await assert.rejects(kiPruefen("Hallo", OEFF, null, { ...KO, apiKey: "", fetch: antwort({}) as unknown as typeof fetch }));
});
await fall("KI: Zeitüberschreitung -> Ausnahme (fail closed)", async () => {
  const langsam = ((_u: string, init: RequestInit) => new Promise((_, nein) => init.signal?.addEventListener("abort", () => nein(new Error("abgebrochen"))))) as unknown as typeof fetch;
  await assert.rejects(kiPruefen("Hallo", OEFF, null, { ...KO, timeoutMs: 50, fetch: langsam }));
});

console.log(fehler === 0 ? "ERGEBNIS: alle Schutzprüfungs-Tests bestanden" : `ERGEBNIS: ${fehler} Fehler`);
if (fehler) throw new Error(`${fehler} Fehler`);
