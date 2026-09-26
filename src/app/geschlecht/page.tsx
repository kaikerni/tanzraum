import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GeschlechtAuswahl } from "@/components/einstellungen/GeschlechtAuswahl";

export const metadata = { title: "Geschlecht – TanzRaum" };

// Einmalige Abfrage fuer Konten ohne Angabe (Pflichtangabe seit der Registrierung)
export default async function GeschlechtSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("mein_geschlecht");
  if (data) redirect("/dashboard");

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Noch eine Angabe</h1>
        <p className="subtitle">
          Damit wir dich im Profil und in der Mitgliederliste richtig bezeichnen (z. B. Tänzerin oder Tänzer), brauchen wir einmalig
          dein Geschlecht. Du kannst es später in den Einstellungen ändern.
        </p>
        <GeschlechtAuswahl modus="erfassen" aktuell={null} />
      </div>
    </div>
  );
}
