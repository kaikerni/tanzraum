
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
