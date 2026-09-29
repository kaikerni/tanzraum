import { createClient } from "@/lib/supabase/server";
import { rechnungPdfHolen } from "@/lib/rechnungen/edge";

// Rechnung(en) als PDF fuer die TanzRaum-Administration:
//   ?id=<uuid>                 eine Rechnung (Vorschau im Browser)
//   ?alle=1[&jahr=2026]        Sammel-PDF (je Rechnung eine Seite), optional nur ein Rechnungsjahr
//   &download=1                als Datei herunterladen statt anzeigen
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const jahr = Number(url.searchParams.get("jahr"));
  const body = UUID.test(id)
    ? { ids: [id] }
    : url.searchParams.get("alle") === "1"
      ? { alle: true as const, ...(Number.isInteger(jahr) && jahr >= 2020 && jahr <= 2100 ? { jahr } : {}) }
      : null;
  if (!body) return new Response("Ungültige Anfrage.", { status: 400 });

  const supabase = await createClient();
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) return new Response("Kein Zugriff.", { status: 403 });

  let antwort: Response;
  try {
    antwort = await rechnungPdfHolen(supabase, body);
  } catch {
    return new Response("Das PDF konnte gerade nicht erstellt werden. Bitte versuche es gleich noch einmal.", { status: 502 });
  }
  if (!antwort.ok || !(antwort.headers.get("content-type") ?? "").includes("application/pdf")) {
    const status = antwort.status === 403 || antwort.status === 404 ? antwort.status : 502;
    return new Response(status === 404 ? "Keine Rechnungen gefunden." : status === 403 ? "Kein Zugriff." : "Das PDF konnte gerade nicht erstellt werden.", {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const dispo = antwort.headers.get("content-disposition") ?? 'inline; filename="TanzRaum-Rechnung.pdf"';
  return new Response(antwort.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": url.searchParams.get("download") === "1" ? dispo.replace(/^inline/, "attachment") : dispo,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
