import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { KinderkontoFormular } from "./KinderkontoFormular";

export const metadata = { title: "Zustimmung der Eltern – TanzRaum" };
export const dynamic = "force-dynamic";

// Konten unter 16 ohne dokumentierte Zustimmung eines Elternteils (z. B. Bestandskonten) – vor jeder Nutzung
export default async function KinderkontoSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: status } = await supabase.rpc("mein_kinderkonto_status");
  if (status === "frei") redirect("/dashboard");
  if (status === "geburtsdatum_fehlt") redirect("/geburtsdatum");

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand-font">Zustimmung deiner Eltern</h1>
        {status === "wartet" ? (
          <>
            <p className="subtitle">
              Deine Eltern haben eine E-Mail von TanzRaum bekommen. Sobald ein Elternteil zugestimmt hat, kannst du TanzRaum wieder nutzen.
            </p>
            <form action={signOut}>
              <button type="submit" className="btn-secondary w-full">
                Abmelden
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="subtitle">
              Du bist unter 16. Damit du TanzRaum nutzen kannst, muss ein Elternteil bzw. Träger der elterlichen Verantwortung zustimmen.
              Deine Eltern bekommen dafür eine E-Mail – ein eigenes TanzRaum-Konto brauchen sie nicht. Bis zur Zustimmung ist dein Konto
              gesperrt. Es wird nicht gelöscht.
            </p>
            <KinderkontoFormular />
          </>
        )}
      </div>
    </div>
  );
}
