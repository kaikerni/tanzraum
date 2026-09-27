import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { RechtsLinks } from "@/components/recht/RechtsLinks";
import { RECHTSTEXT_VERSION } from "@/lib/recht/versionen";
import { RechtstexteFormular } from "./RechtstexteFormular";

export const metadata = { title: "Nutzungsbedingungen – TanzRaum" };
export const dynamic = "force-dynamic";

// Bestandskonten bzw. neue Fassung der Nutzungsbedingungen: einmalige Zustimmung vor der weiteren Nutzung
export default async function RechtstexteSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: offen } = await supabase.rpc("rechtstexte_offen");
  if (offen === false) redirect("/dashboard");

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Nutzungsbedingungen</h1>
        <p className="subtitle">
          Bitte bestätige die aktuellen Nutzungsbedingungen (Stand {RECHTSTEXT_VERSION.nutzungsbedingungen}). Die Datenschutzerklärung
          (Stand {RECHTSTEXT_VERSION.datenschutz}) erklärt, wie TanzRaum mit deinen Daten umgeht.
        </p>
        <RechtstexteFormular />
        <form action={signOut} className="mt-3">
          <button type="submit" className="btn-secondary w-full">
            Abmelden
          </button>
        </form>
        <RechtsLinks className="mt-4 justify-center" />
      </div>
    </div>
  );
}
