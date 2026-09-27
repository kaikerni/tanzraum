import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { AnbieterFormular, type AnbieterDaten } from "@/components/admin/AnbieterFormular";

export const metadata = { title: "Anbieterangaben – TanzRaum-Administration" };

export default async function AnbieterSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data: a } = await supabase.from("plattform_anbieter").select("*").eq("id", true).maybeSingle();

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <section className={KARTE}>
        <KarteKopf
          icon={Building2}
          titel="Anbieterangaben"
          untertitel="Zentrale Stelle für Impressum, Kontakt, Datenschutzerklärung, Nutzungsbedingungen (Widerruf) und Rechnungen."
        />
        {a ? <AnbieterFormular a={a as AnbieterDaten} /> : <p className="text-[13.5px] text-brand-ink-soft">Die Angaben konnten nicht geladen werden.</p>}
      </section>
    </div>
  );
}
