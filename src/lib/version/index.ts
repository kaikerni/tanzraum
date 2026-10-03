// Aktuelle TanzRaum-Version: Versionsnummer aus package.json, Build = Commit (beim Bauen gesetzt, siehe next.config.mjs).
export const TANZRAUM_VERSION = process.env.NEXT_PUBLIC_TANZRAUM_VERSION ?? "0.0.0";
export const TANZRAUM_BUILD = process.env.NEXT_PUBLIC_TANZRAUM_BUILD ?? "lokal";
// Eindeutig je Build (auch bei gleichem Commit) – zum Erkennen einer neu eingespielten Version
export const TANZRAUM_BUILD_ID = process.env.NEXT_PUBLIC_TANZRAUM_BUILD_ID ?? "lokal";

export function versionText(): string {
  return `TanzRaum ${TANZRAUM_VERSION} · Build ${TANZRAUM_BUILD}`;
}

// Semver-Vergleich (1.10.0 > 1.9.3); ungueltige Angaben gelten als 0.0.0
export function versionVergleich(a: string, b: string): number {
  const teile = (v: string) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split(".").map(Number) : [0, 0, 0]);
  const x = teile(a);
  const y = teile(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
