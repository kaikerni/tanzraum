import type { SupabaseClient } from "@supabase/supabase-js";

// Rechnungs-PDFs aus der Edge Function "rechnung-pdf" (binaer per fetch mit der Sitzung der angemeldeten Person;
// welche Rechnungen sichtbar sind, entscheidet RLS – die Plattform-Administration sieht alle).
export async function rechnungPdfHolen(supabase: SupabaseClient, body: { ids: string[] } | { alle: true; jahr?: number }): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response("Nicht angemeldet.", { status: 401 });
  return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/rechnung-pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
}
