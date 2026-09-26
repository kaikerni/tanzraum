import { headers } from "next/headers";

// Oeffentliche Basis-URL der aktuellen Anfrage (z. B. https://tanzraum.app oder http://localhost:3000).
// Fuer Links in E-Mails prueft Supabase Auth die Adresse zusaetzlich gegen die Redirect-Allowlist.
export async function basisUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Nur interne Pfade: "//host" oder "/\host" wuerden Browser als fremde Seite interpretieren.
export function internerPfad(wert: string | null | undefined, standard = "/dashboard"): string {
  const w = String(wert ?? "");
  return w.startsWith("/") && !w.startsWith("//") && !w.startsWith("/\\") ? w : standard;
}
