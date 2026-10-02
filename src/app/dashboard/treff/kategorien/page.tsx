import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KategorienVerwaltung } from "@/components/treff/KategorienVerwaltung";
import { kategorienListe } from "@/lib/treff/laden";

export const metadata = { title: "Treff-Kategorien – TanzRaum" };

export default async function TreffKategorien() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard/treff");
  const kategorien = await kategorienListe(supabase);
  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-4">
      <Link href="/dashboard/treff" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> TanzRaum Treff
      </Link>
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Settings2 size={24} className="text-brand-red" /> Treff-Kategorien
      </h1>
      <p className="text-[13.5px] text-brand-ink-soft">Deaktivierte Kategorien erscheinen nicht mehr bei neuen Themen; bestehende Themen bleiben erhalten. Löschen geht nur bei leeren Kategorien.</p>
      <section className={KARTE}>
        <KategorienVerwaltung kategorien={kategorien} />
      </section>
    </div>
  );
}
