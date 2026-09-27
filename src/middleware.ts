import { type NextRequest } from "next/server";
import { updateSession, zurHauptadresse } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return zurHauptadresse(request) ?? (await updateSession(request));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|service-worker\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
