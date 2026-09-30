import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ANSICHT_COOKIE, istAnsicht, type Ansicht } from "@/lib/admin/ansicht";
import { vorschauFetch } from "@/lib/admin/vorschauFetch";

type CookieToSet = { name: string; value: string; options: CookieOptions };

async function baueClient(fetchFn?: typeof fetch) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      ...(fetchFn ? { global: { fetch: fetchFn } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Wird von Server Components aufgerufen, die keine Cookies setzen duerfen
          // (nur Server Actions/Route Handlers duerfen das) -- die Middleware haelt
          // die Session in diesem Fall trotzdem aktuell.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ignorieren
          }
        },
      },
    },
  );
}

// Immer die echte Datenbank (z. B. um „Ansicht als …“ zu beenden)
export async function createRealClient() {
  return baueClient();
}

// „Ansicht als …“ der TanzRaum-Administration: nur wirksam, wenn die echte Datenbank die Plattform-Administration bestaetigt
export type VorschauEinstellungen = { musikAn: boolean; spotlightsAktiv: boolean; spotlightsTarife: string[] };

export const vorschauStatus = cache(async (): Promise<({ ansicht: Ansicht; userId: string } & VorschauEinstellungen) | null> => {
  const wert = (await cookies()).get(ANSICHT_COOKIE)?.value;
  if (!istAnsicht(wert)) return null;
  const echt = await baueClient();
  const {
    data: { user },
  } = await echt.auth.getUser();
  if (!user) return null;
  // Plattform-Schalter (Musik, Spotlights) wie in echt – damit die Vorschau zeigt, was Nutzer gerade sehen
  const [{ data: admin }, { data: musik }, { data: e }] = await Promise.all([
    echt.rpc("ist_plattform_admin_aktuell"),
    echt.rpc("musik_freigegeben"),
    echt.from("plattform_einstellungen").select("spotlights_aktiv, spotlights_tarife").eq("id", true).maybeSingle(),
  ]);
  if (admin !== true) return null;
  return {
    ansicht: wert,
    userId: user.id,
    musikAn: musik === true,
    spotlightsAktiv: e?.spotlights_aktiv === true,
    spotlightsTarife: Array.isArray(e?.spotlights_tarife) ? (e.spotlights_tarife as string[]) : [],
  };
});

// In der Vorschau beantwortet ein Beispiel-Datenbestand alle Datenbank-Anfragen (nichts Echtes wird gelesen oder geschrieben)
export async function createClient() {
  const vorschau = await vorschauStatus();
  if (!vorschau) return baueClient();
  return baueClient(vorschauFetch(vorschau.ansicht, vorschau.userId, vorschau));
}
