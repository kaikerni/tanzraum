import type { SupabaseClient } from "@supabase/supabase-js";

// Aufrufe der Edge Function "mitgliedsantrag" mit der Sitzung der angemeldeten Person.
// JSON-Antworten ueber functions.invoke; PDFs (binaer) direkt per fetch, damit nichts als Text dekodiert wird.

const FUNKTION = "mitgliedsantrag";

export async function antragFunktion(supabase: SupabaseClient, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.functions.invoke(FUNKTION, { body });
  if (error) return null;
  return (data ?? null) as Record<string, unknown> | null;
}

export async function antragPdfHolen(supabase: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return new Response("Nicht angemeldet.", { status: 401 });
  return fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${FUNKTION}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
}
