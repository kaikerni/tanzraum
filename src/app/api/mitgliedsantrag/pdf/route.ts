import { createClient } from "@/lib/supabase/server";
import { antragPdfHolen } from "@/lib/antraege/edge";

// PDF eines Mitgliedsantrags (?antrag=<id>) bzw. Muster des Vereinsformulars (?muster=<verein-id>).
// Zugriff prueft die Edge Function (RLS als angemeldete Person). Anzeige im Browser -> Drucken.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const antrag = url.searchParams.get("antrag") ?? "";
  const muster = url.searchParams.get("muster") ?? "";
  const body = UUID.test(antrag) ? { aktion: "pdf", antrag_id: antrag } : UUID.test(muster) ? { aktion: "muster", verein_id: muster } : null;
  if (!body) return new Response("Ungültige Anfrage.", { status: 400 });

  const supabase = await createClient();
  let antwort: Response;
  try {
    antwort = await antragPdfHolen(supabase, body);
  } catch {
    return new Response("Das PDF konnte gerade nicht erstellt werden. Bitte versuche es gleich noch einmal.", { status: 502 });
  }
  if (!antwort.ok || !(antwort.headers.get("content-type") ?? "").includes("application/pdf")) {
    const status = antwort.status === 401 || antwort.status === 403 || antwort.status === 404 ? antwort.status : 502;
    return new Response(status === 502 ? "Das PDF konnte gerade nicht erstellt werden." : "Kein Zugriff auf diesen Antrag.", {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(antwort.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": antwort.headers.get("content-disposition") ?? 'inline; filename="Mitgliedsantrag.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
