// Ort/Adresse -> Koordinaten ueber die Google Geocoding API (serverseitig).
// Schluessel nur auf dem Server: GOOGLE_MAPS_SERVER_KEY (in Google Cloud auf die Server-IP beschraenken).
// Nur bei Bedarf (Speichern), keine Massenabfragen.
export type Position = { lat: number; lng: number; anzeige: string };

// Laender, in denen gesucht wird (Treffer ausserhalb werden verworfen)
const LAENDER = new Set(["DE", "AT", "CH", "LU", "BE", "NL", "DK", "FR", "IT", "PL", "CZ"]);

type Komponente = { long_name: string; short_name: string; types: string[] };
type Treffer = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: Komponente[];
  types: string[];
};

// Browser-Schluessel fuer die Karte (Maps JavaScript API). Ist oeffentlich sichtbar und muss in Google Cloud
// auf die Domain tanzraum.app beschraenkt sein. Wird zur Laufzeit gelesen, nicht in den Build eingebaut.
export function googleMapsBrowserSchluessel(): string {
  return process.env.GOOGLE_MAPS_BROWSER_KEY?.trim() ?? "";
}

export function ortssucheEingerichtet(): boolean {
  return !!process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
}

function teil(t: Treffer, ...typen: string[]): Komponente | undefined {
  for (const typ of typen) {
    const k = t.address_components.find((c) => c.types.includes(typ));
    if (k) return k;
  }
  return undefined;
}

async function google(params: Record<string, string>): Promise<Treffer[] | null> {
  const schluessel = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (!schluessel) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("language", "de");
  url.searchParams.set("region", "de");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", schluessel);
  try {
    const antwort = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!antwort.ok) return null;
    const daten = (await antwort.json()) as { status: string; results?: Treffer[]; error_message?: string };
    if (daten.status === "ZERO_RESULTS") return [];
    if (daten.status !== "OK") {
      // Schluessel/Kontingent-Probleme im Serverlog sichtbar machen (ohne Schluessel)
      console.error("Google Geocoding:", daten.status, daten.error_message ?? "");
      return null;
    }
    return (daten.results ?? []).filter((t) => LAENDER.has(teil(t, "country")?.short_name ?? ""));
  } catch {
    return null;
  }
}

export async function geocode(suche: string): Promise<Position | null> {
  const q = suche.trim();
  if (q.length < 2) return null;
  const t = (await google({ address: q }))?.[0];
  if (!t) return null;
  const { lat, lng } = t.geometry.location;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, anzeige: t.formatted_address };
}

// Fuer Personen auf der Map: nur Ort/PLZ, niemals Strasse. Gespeichert wird der Ortsname aus dem Suchergebnis
// (nicht die Eingabe) und die Position der Ortsmitte – auch wenn jemand eine genaue Adresse eintippt.
export type Ortsangabe = { ort: string; lat: number; lng: number };

const ORTSGENAU = new Set(["locality", "postal_code", "postal_town", "administrative_area_level_3", "sublocality", "political"]);

export async function ortFinden(eingabe: string): Promise<Ortsangabe | null> {
  const q = eingabe.trim();
  if (q.length < 2) return null;
  const treffer = (await google({ address: q }))?.[0];
  if (!treffer) return null;
  const name = teil(treffer, "locality", "postal_town", "administrative_area_level_3", "sublocality", "administrative_area_level_2")?.long_name;
  if (!name) return null;
  const land = teil(treffer, "country")?.short_name ?? "DE";
  const plzRoh = teil(treffer, "postal_code")?.long_name ?? "";
  const plz = /^\d{4,5}$/.test(plzRoh) ? plzRoh : "";
  // Ortsmitte statt der eingegebenen Adresse
  const mitte = (await google({ components: [`locality:${name}`, plz ? `postal_code:${plz}` : "", `country:${land}`].filter(Boolean).join("|") }))?.[0];
  // Ohne eigenen Ortstreffer nur dann die erste Position nehmen, wenn sie selbst nicht genauer als der Ort ist
  const quelle = mitte ?? (treffer.types.every((typ) => ORTSGENAU.has(typ)) ? treffer : null);
  if (!quelle) return null;
  const { lat, lng } = quelle.geometry.location;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { ort: [plz, name].filter(Boolean).join(" "), lat, lng };
}
