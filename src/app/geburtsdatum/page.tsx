import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GeburtsdatumFormular } from "./GeburtsdatumFormular";

export const metadata = { title: "Geburtsdatum – TanzRaum" };

// Einmalige Abfrage fuer Konten ohne Geburtsdatum (Jugendschutz im Netzwerk und bei Nachrichten)
export default async function GeburtsdatumSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.rpc("mein_geburtsdatum");
  if (data) redirect("/dashboard");

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Noch eine Angabe</h1>
        <p className="subtitle">
          Für den Jugendschutz bei Nachrichten, im Netzwerk und auf der TanzRaum Map brauchen wir einmalig dein Geburtsdatum. Es wird
          niemandem angezeigt.
        </p>
        <GeburtsdatumFormular />
      </div>
    </div>
  );
}
