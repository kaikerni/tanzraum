import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Hochgeladene bzw. abgelegte Datei eines Antrags (?antrag=<id>&art=papier|aufnahme).
// Kurzlebiger, signierter Link aus dem privaten Speicher; die Storage-Regeln pruefen den Zugriff.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const antrag = url.searchParams.get("antrag") ?? "";
  const art = url.searchParams.get("art");
  if (!UUID.test(antrag) || (art !== "papier" && art !== "aufnahme")) return new Response("Ungültige Anfrage.", { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.from("beitrittsantraege").select("papier_datei, aufnahme_pdf").eq("id", antrag).maybeSingle();
  const pfad = art === "papier" ? data?.papier_datei : data?.aufnahme_pdf;
  if (!pfad) return new Response("Datei nicht gefunden.", { status: 404 });
  const { data: link } = await supabase.storage.from("mitgliedsantraege").createSignedUrl(pfad, 60);
  if (!link?.signedUrl) return new Response("Kein Zugriff auf diese Datei.", { status: 403 });
  return NextResponse.redirect(link.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
