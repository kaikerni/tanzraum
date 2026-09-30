import { createBrowserClient } from "@supabase/ssr";

// In „Ansicht als …“ (Hinweis-Cookie der Administration) schreibt der Browser nichts in die echte Datenbank
function vorschauAktiv(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").includes("tr_vorschau=1");
}

const nurLesen: typeof fetch = async (eingabe, init) => {
  const methode = (init?.method ?? "GET").toUpperCase();
  const url = typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url;
  const schreibend = methode !== "GET" && methode !== "HEAD" && !url.includes("/auth/v1/") && !url.includes("/rest/v1/rpc/online_");
  if (vorschauAktiv() && schreibend) {
    return new Response(JSON.stringify({ code: "42501", message: "Vorschau: Änderungen werden nicht gespeichert.", statusCode: "403", error: "Vorschau" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return fetch(eingabe, init);
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { fetch: nurLesen } },
  );
}
