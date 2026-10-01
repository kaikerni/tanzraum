import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Version (manuell gepflegt): package.json "version" – z. B. 1.2.0
const paket = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Build (Commit): TANZRAUM_BUILD beim Bauen setzen (z. B. TANZRAUM_BUILD=9f0dde4), sonst aus git, sonst "lokal"
function commit() {
  const vorgabe = (process.env.TANZRAUM_BUILD ?? "").trim();
  if (/^[0-9a-zA-Z._-]{1,40}$/.test(vorgabe)) return vorgabe;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "lokal";
  } catch {
    return "lokal";
  }
}
const build = commit();
// Eindeutige Kennung je Build: daran erkennt die Web-App, dass auf dem Server eine neue Version laeuft.
// Next.js laedt diese Datei beim Bauen mehrfach (auch in Unterprozessen) – die Kennung wird deshalb einmal
// festgelegt und ueber die Umgebung weitergereicht, damit Server, Browser-Code und .next/BUILD_ID gleich sind.
if (!process.env.TANZRAUM_BUILD_ID) process.env.TANZRAUM_BUILD_ID = `${build}-${Date.now().toString(36)}`;
const buildId = process.env.TANZRAUM_BUILD_ID;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Eigenstaendiges Server-Paket (.next/standalone) fuer den Betrieb auf einem eigenen Node.js-Server
  output: "standalone",
  generateBuildId: async () => buildId,
  env: {
    NEXT_PUBLIC_TANZRAUM_VERSION: paket.version,
    NEXT_PUBLIC_TANZRAUM_BUILD: build,
    NEXT_PUBLIC_TANZRAUM_BUILD_ID: buildId,
  },
  async headers() {
    // Service Worker und Manifest nie aus dem Browser-Cache: so kommt eine neue Version sofort an.
    // Seiten sind dynamisch (keine Zwischenspeicherung), /_next/static ist durch Hash-Namen sicher versioniert.
    const frisch = [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }];
    return [
      { source: "/sw.js", headers: frisch },
      { source: "/service-worker.js", headers: frisch },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/api/version", headers: frisch },
    ];
  },
};

export default nextConfig;
