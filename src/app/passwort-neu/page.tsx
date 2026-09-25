import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NeuFormular } from "./NeuFormular";

export const metadata = { title: "Neues Passwort – TanzRaum" };

export default async function PasswortNeuSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: recovery } = user ? await supabase.rpc("ist_recovery_sitzung") : { data: false };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {recovery === true ? (
          <>
            <h1 className="brand-font">Neues Passwort festlegen</h1>
            <p className="subtitle">Wähle ein neues Passwort für dein TanzRaum-Konto ({user?.email}).</p>
            <NeuFormular />
          </>
        ) : (
          <>
            <h1 className="brand-font">Link abgelaufen</h1>
            <p className="subtitle">
              Der Link zum Zurücksetzen ist abgelaufen, wurde bereits verwendet oder ist ungültig. Aus Sicherheitsgründen ist er nur
              kurze Zeit gültig.
            </p>
            <Link href="/passwort-vergessen" className="btn-primary block text-center">
              Neuen Link anfordern
            </Link>
            {user && (
              <p className="auth-switch">
                Du bist angemeldet und möchtest dein Passwort ändern? <Link href="/dashboard/einstellungen">Zu den Einstellungen</Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
