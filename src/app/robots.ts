import type { MetadataRoute } from "next";

// Nur oeffentliche Seiten indexieren; der angemeldete Bereich bleibt ausgeschlossen
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/impressum", "/datenschutz", "/nutzungsbedingungen", "/lizenz", "/kontakt"], disallow: ["/dashboard", "/api", "/juryraum", "/onboarding"] },
    sitemap: "https://tanzraum.app/sitemap.xml",
  };
}
