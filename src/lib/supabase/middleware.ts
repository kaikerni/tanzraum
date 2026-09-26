import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const OEFFENTLICHE_PFADE = ["/login", "/signup", "/gesperrt", "/auth", "/passwort-vergessen", "/passwort-neu", "/impressum", "/datenschutz", "/nutzungsbedingungen"];

function istOeffentlich(pathname: string) {
  return OEFFENTLICHE_PFADE.some(
    (pfad) => pathname === pfad || pathname.startsWith(`${pfad}/`),
  );
}

// Next.js laeuft hinter nginx auf 127.0.0.1:3000; request.nextUrl zeigt dort auf
// http://localhost:3000. Weiterleitungen muessen die oeffentliche Adresse verwenden,
// die nginx per X-Forwarded-Host/-Proto mitgibt (lokal ohne nginx: Host-Header).
function oeffentlicheUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "http" || proto === "https") url.protocol = `${proto}:`;
  if (host) {
    url.host = host;
    // Der interne Port (3000) darf nicht erhalten bleiben, wenn der Host keinen eigenen hat.
    if (!/:\d+$/.test(host)) url.port = "";
  }
  return url;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // WICHTIG: getUser() nicht weglassen/durch getSession() ersetzen -- nur getUser()
  // validiert das Token serverseitig bei Supabase Auth statt dem Cookie zu vertrauen.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !istOeffentlich(pathname)) {
    const url = oeffentlicheUrl(request);
    url.pathname = "/login";
    url.searchParams.set("weiter", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = oeffentlicheUrl(request);
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
