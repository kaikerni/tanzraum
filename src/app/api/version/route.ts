import { NextResponse } from "next/server";
import { TANZRAUM_BUILD, TANZRAUM_BUILD_ID, TANZRAUM_VERSION } from "@/lib/version";

// Welche Version laeuft gerade auf dem Server? (oeffentlich, ohne Daten; nie zwischengespeichert)
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: TANZRAUM_VERSION, build: TANZRAUM_BUILD, buildId: TANZRAUM_BUILD_ID },
    { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } },
  );
}
