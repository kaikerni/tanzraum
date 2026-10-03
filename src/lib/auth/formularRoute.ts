import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Bausteine fuer die Auth-Formulare (Link einloesen, Passwort vergessen, neues Passwort).
// Diese Formulare laufen bewusst NICHT ueber Server Actions, sondern als normales HTML-Formular (POST) an einen
// festen Route Handler: Server-Action-IDs aendern sich mit jedem Build; eine Seite aus einem aelteren Build
// (z. B. waehrend eines Updates geoeffnet) fuehrt sonst zu "Failed to find Server Action" / "Application error".
// Die Formulare funktionieren ausserdem ohne JavaScript.

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Supabase-Client fuer einen Route Handler: liest die Cookies der Anfrage und sammelt neue Sitzungs-Cookies,
// die mit der Weiterleitung an den Browser gehen.
export function routeClient(request: NextRequest) {
  const neueCookies: CookieToSet[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(liste: CookieToSet[]) {
        neueCookies.push(...liste);
      },
    },
  });
  return { supabase, neueCookies };
}

// 303 "See Other": der Browser laedt das Ziel per GET (kein erneutes Absenden beim Neuladen).
// Relativer Location-Header, damit hinter nginx immer die oeffentliche Adresse verwendet wird.
export function weiterleiten(pfad: string, cookies: CookieToSet[] = []) {
  const antwort = new NextResponse(null, { status: 303, headers: { Location: pfad, "Cache-Control": "no-store" } });
  for (const { name, value, options } of cookies) antwort.cookies.set(name, value, options);
  return antwort;
}

// Schutz vor fremden Seiten, die das Formular absenden (CSRF): Browser senden bei POST den Origin-Header
// (aeltere ggf. nur Referer). Er muss zur eigenen, von nginx weitergereichten Adresse passen.
export function gleicherUrsprung(request: NextRequest): boolean {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const herkunft = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !herkunft || herkunft === "null") return false;
  try {
    return new URL(herkunft).host === host;
  } catch {
    return false;
  }
}

// Textfeld aus einem abgesendeten Formular (fehlend oder Datei -> "")
export function feld(daten: FormData, name: string): string {
  const wert = daten.get(name);
  return typeof wert === "string" ? wert : "";
}
