
// Ort/Adresse -> Koordinaten ueber OpenStreetMap Nominatim (serverseitig, ohne Schluessel).
// Nutzungsregeln: eindeutiger User-Agent, nur bei Bedarf (Speichern), keine Massenabfragen.
export type Position = { lat: number; lng: number; anzeige: string };

export async function geocode(suche: string): Promise<Position | null> {
  const q = suche.trim();
  if (q.length < 2) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de,at,ch,lu,be,nl,dk,fr,it,pl,cz");
  url.searchParams.set("q", q);
  try {
    const antwort = await fetch(url, {
      headers: { "User-Agent": "TanzRaum/1.0 (https://tanzraum.app; info@tanzraum.app)", "Accept-Language": "de" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!antwort.ok) return null;
    const daten = (await antwort.json()) as { lat: string; lon: string; display_name: string }[];
    const t = daten[0];
    if (!t) return null;
    const lat = Number(t.lat);
    const lng = Number(t.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, anzeige: t.display_name };
  } catch {
    return null;
  }
}

// Fuer Personen auf der Map: nur Ort/PLZ, niemals Strasse. Gespeichert wird der Ortsname aus dem Suchergebnis
// (nicht die Eingabe) und die Position der Ortsmitte – auch wenn jemand eine genaue Adresse eintippt.
export type Ortsangabe = { ort: string; lat: number; lng: number };

async function nominatim(params: Record<string, string>): Promise<Record<string, unknown>[] | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de,at,ch,lu,be,nl,dk,fr,it,pl,cz");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const antwort = await fetch(url, {
      headers: { "User-Agent": "TanzRaum/1.0 (https://tanzraum.app; info@tanzraum.app)", "Accept-Language": "de" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    return antwort.ok ? ((await antwort.json()) as Record<string, unknown>[]) : null;
  } catch {
    return null;
  }
}

export async function ortFinden(eingabe: string): Promise<Ortsangabe | null> {
  const q = eingabe.trim();
  if (q.length < 2) return null;
  const treffer = (await nominatim({ q, addressdetails: "1" }))?.[0];
  if (!treffer) return null;
  const a = (treffer.address ?? {}) as Record<string, string>;
  const name = a.city || a.town || a.village || a.municipality || a.suburb || a.county;
  if (!name) return null;
  const plz = a.postcode && /^\d{4,5}$/.test(a.postcode) ? a.postcode : "";
  // Ortsmitte statt der eingegebenen Adresse
  const mitte = (await nominatim({ city: name, ...(plz ? { postalcode: plz } : {}) }))?.[0] ?? treffer;
  const lat = Number(mitte.lat);
  const lng = Number(mitte.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { ort: [plz, name].filter(Boolean).join(" "), lat, lng };
}
