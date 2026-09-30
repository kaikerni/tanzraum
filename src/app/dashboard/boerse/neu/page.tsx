import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { AngebotFormular } from "@/components/boerse/AngebotFormular";
import { HandelnHinweis } from "@/components/boerse/HandelnHinweis";
import { getKategorien } from "@/lib/boerse";

export const metadata = { title: "Angebot einstellen – TanzRaum Börse" };

export default async function NeuesAngebot() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/boerse/neu");
  const [{ data: grund }, kategorien] = await Promise.all([supabase.rpc("boerse_darf_handeln"), getKategorien(supabase)]);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/boerse" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zur TanzRaum Börse
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Angebot einstellen</h1>
      {grund ? (
        <HandelnHinweis grund={String(grund)} />
      ) : (
        <section className={KARTE}>
          <AngebotFormular userId={user.id} kategorien={kategorien} />
        </section>
      )}
    </div>
  );
}
