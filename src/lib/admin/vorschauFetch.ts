import type { Ansicht } from "@/lib/admin/ansicht";
import { vorschauDaten } from "@/lib/admin/vorschauDatenbank";

// Datenbank-Anfragen in „Ansicht als …“ werden hier mit Beispieldaten beantwortet (nur die Anmeldung geht an Supabase).
// Schreibende Anfragen werden nie weitergeleitet: Die Vorschau speichert nichts und liest keine echten Daten.

const JSON_KOPF = { "content-type": "application/json; charset=utf-8" };
export const VORSCHAU_NUR_LESEN = "Vorschau: Änderungen werden nicht gespeichert.";

function antwort(status: number, wert: unknown, kopf: Record<string, string> = {}): Response {
  return new Response(wert === undefined ? null : JSON.stringify(wert), { status, headers: { ...JSON_KOPF, ...kopf } });
}

// deno-lint-ignore no-explicit-any
function passt(zeile: any, schluessel: string, bedingung: string): boolean {
  if (!(schluessel in zeile)) return true;
  const wert = zeile[schluessel];
  const punkt = bedingung.indexOf(".");
  const op = bedingung.slice(0, punkt);
  const w = bedingung.slice(punkt + 1);
  if (op === "eq") return String(wert) === w;
  if (op === "neq") return String(wert) !== w;
  if (op === "is") return w === "null" ? wert === null : String(wert) === w;
  if (op === "in") return w.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/"/g, "")).includes(String(wert));
  if (op === "gte") return String(wert) >= w;
  if (op === "lte") return String(wert) <= w;
  if (op === "gt") return String(wert) > w;
  if (op === "lt") return String(wert) < w;
  return true;
}

export function vorschauFetch(ansicht: Ansicht, userId: string, einstellungen: { musikAn: boolean }, echt: typeof fetch = fetch): typeof fetch {
  const daten = vorschauDaten(ansicht, userId, einstellungen);
  return async (eingabe: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url);
    const methode = (init?.method ?? (eingabe instanceof Request ? eingabe.method : "GET")).toUpperCase();
    const kopf = new Headers(init?.headers ?? (eingabe instanceof Request ? eingabe.headers : undefined));
    const pfad = url.pathname;

    // Anmeldung/Sitzung: echt (die Administration bleibt angemeldet)
    if (pfad.startsWith("/auth/v1/")) return echt(eingabe, init);

    if (pfad.startsWith("/rest/v1/rpc/")) {
      const name = pfad.slice("/rest/v1/rpc/".length);
      let body: unknown = {};
      try {
        body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      } catch {
        body = {};
      }
      const eintrag = daten.rpc[name];
      const wert = typeof eintrag === "function" ? eintrag(body) : (eintrag ?? null);
      if ((kopf.get("accept") ?? "").includes("vnd.pgrst.object")) return antwort(200, Array.isArray(wert) ? (wert[0] ?? null) : wert);
      return antwort(200, wert);
    }

    if (pfad.startsWith("/rest/v1/")) {
      if (methode !== "GET" && methode !== "HEAD") return antwort(403, { code: "42501", message: VORSCHAU_NUR_LESEN, details: null, hint: null });
      const tabelle = pfad.slice("/rest/v1/".length);
      const filter = [...url.searchParams].filter(([k]) => !["select", "order", "limit", "offset", "or", "and"].includes(k));
      let zeilen = (daten.tab[tabelle] ?? []).filter((z) => filter.every(([k, v]) => passt(z, k, v)));
      const limit = Number(url.searchParams.get("limit") ?? "");
      if (Number.isFinite(limit) && limit > 0) zeilen = zeilen.slice(0, limit);
      const bereich = { "content-range": `0-${Math.max(0, zeilen.length - 1)}/${zeilen.length}` };
      if (methode === "HEAD") return new Response(null, { status: 200, headers: { ...JSON_KOPF, ...bereich } });
      if ((kopf.get("accept") ?? "").includes("vnd.pgrst.object")) {
        return zeilen.length ? antwort(200, zeilen[0]) : antwort(406, { code: "PGRST116", message: "no rows", details: null, hint: null });
      }
      return antwort(200, zeilen, bereich);
    }

    if (pfad.startsWith("/storage/v1/")) {
      // Signierte Links: nur Platzhalter (keine echten Dateien in der Vorschau)
      if (pfad.startsWith("/storage/v1/object/sign/") && methode === "POST") {
        let body: { paths?: string[] } = {};
        try {
          body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
        } catch {
          body = {};
        }
        if (body.paths) return antwort(200, body.paths.map((p) => ({ path: p, signedURL: null, error: "Vorschau" })));
        return antwort(400, { statusCode: "400", error: "Vorschau", message: VORSCHAU_NUR_LESEN });
      }
      return antwort(403, { statusCode: "403", error: "Vorschau", message: VORSCHAU_NUR_LESEN });
    }

    if (pfad.startsWith("/functions/v1/")) return antwort(403, { error: VORSCHAU_NUR_LESEN });
    return antwort(200, null);
  };
}
