import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { WorkshopFormular } from "@/components/workshops/WorkshopFormular";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";

export const metadata = { title: "Workshop einreichen – TanzRaum" };

export default async function WorkshopNeu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/workshops/neu");
  const [rechte, { data: status }] = await Promise.all([meineTeamRechte(supabase), supabase.rpc("treff_mein_status")]);
  const unter16 = (status as { unter_16?: boolean } | null)?.unter_16 === true;
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link href="/dashboard/workshops" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> Workshops
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <GraduationCap size={26} className="text-brand-red" /> Workshop einreichen
      </h1>
      <section className={KARTE}>
        {unter16 ? (
          <p className="text-[14px] text-brand-ink-soft">Workshops einreichen ist ab 16 Jahren möglich. Ansehen kannst du alle Workshops.</p>
        ) : (
          <WorkshopFormular userId={user.id} direktMoeglich={darfTeam(rechte, "workshops.erstellen") && darfTeam(rechte, "workshops.freigeben")} />
        )}
      </section>
    </div>
  );
}
