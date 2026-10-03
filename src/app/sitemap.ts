import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const basis = "https://tanzraum.app";
  return ["", "/lizenz", "/impressum", "/datenschutz", "/nutzungsbedingungen", "/kontakt", "/signup", "/login"].map((pfad) => ({
    url: `${basis}${pfad}`,
    changeFrequency: pfad === "" ? "weekly" : "monthly",
    priority: pfad === "" ? 1 : 0.5,
  }));
}
