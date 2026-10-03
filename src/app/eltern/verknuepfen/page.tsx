import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RechtsLinks } from "@/components/recht/RechtsLinks";
import { VerknuepfenFormular } from "./VerknuepfenFormular";

export const metadata = { title: "Elternkonto verknüpfen – TanzRaum" };
export const dynamic = "force-dynamic";

// Optional nach der Zustimmung: eigenes Elternkonto anlegen bzw. anmelden und mit dem Kinderkonto verknuepfen.
export default async function ElternVerknuepfenSeite({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const zurueck = `/eltern/verknuepfen?token=${encodeURIComponent(token)}`;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Elternkonto verknüpfen</h1>
        <p className="subtitle">
          Mit einem eigenen TanzRaum-Konto verwaltest du die Schutzeinstellungen deines Kindes (Nachrichten, Map, Spotlights, Push).
          Verwende dieselbe E-Mail-Adresse, an die unsere E-Mail ging.
        </p>
        {!token ? (
          <p className="form-error">Dieser Link ist ungültig.</p>
        ) : user ? (
          <>
            <p className="mb-3 text-[13.5px] text-brand-ink-soft">Angemeldet als {user.email}.</p>
            <VerknuepfenFormular token={token} />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Link href={`/login?weiter=${encodeURIComponent(zurueck)}`} className="btn-primary text-center">
              Anmelden
            </Link>
            <Link href={`/signup?weiter=${encodeURIComponent(zurueck)}`} className="btn-secondary text-center">
              Neues Elternkonto erstellen
            </Link>
          </div>
        )}
        <RechtsLinks className="mt-4 justify-center" />
      </div>
    </div>
  );
}
