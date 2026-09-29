import { createClient } from "@/lib/supabase/server";

// Zahlungsaufforderung (Vereinslizenz per Ueberweisung) als PDF: ?id=<uuid>[&download=1]
// Zugriff prueft die Edge Function per RLS (Vereinsadmin des Vereins, Plattform-Administration).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  if (!UUID.test(id)) return new Response("Ungültige Anfrage.", { status: 400 });
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response("Nicht angemeldet.", { status: 401 });
  let antwort: Response;
  try {
    antwort = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/zahlungsaufforderung`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ aufforderung_id: id, aktion: "pdf" }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return new Response("Das PDF konnte gerade nicht erstellt werden.", { status: 502 });
  }
  if (!antwort.ok || !(antwort.headers.get("content-type") ?? "").includes("application/pdf")) {
    return new Response(antwort.status === 403 || antwort.status === 404 ? "Kein Zugriff." : "Das PDF konnte gerade nicht erstellt werden.", {
      status: antwort.status === 403 || antwort.status === 404 ? antwort.status : 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const dispo = antwort.headers.get("content-disposition") ?? 'inline; filename="TanzRaum-Zahlungsaufforderung.pdf"';
  return new Response(antwort.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": url.searchParams.get("download") === "1" ? dispo.replace(/^inline/, "attachment") : dispo,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
