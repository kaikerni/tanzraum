import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { NeuesThema } from "@/components/treff/NeuesThema";
import { SchreibHinweis } from "@/components/treff/TreffBausteine";
import { kategorienListe, treffStatus } from "@/lib/treff/laden";
import { darfThemaErstellen } from "@/lib/treff/treff";

export const metadata = { title: "Neues Thema – TanzRaum Treff" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TreffNeu({ searchParams }: { searchParams: Promise<{ kategorie?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/treff/neu");
  const [status, kategorien, sp] = await Promise.all([treffStatus(supabase), kategorienListe(supabase), searchParams]);
  const darf = darfThemaErstellen(status);
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link href="/dashboard/treff" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> TanzRaum Treff
      </Link>
      <h1 className="flex items-center gap-2 text-[24px] font-extrabold tracking-tight text-brand-ink">
        <MessageSquareText size={24} className="text-brand-red" /> Neues Thema
      </h1>
      {darf ? (
        <section className={KARTE}>
          <NeuesThema userId={user.id} kategorien={kategorien} startKategorie={sp.kategorie && UUID.test(sp.kategorie) ? sp.kategorie : null} />
        </section>
      ) : (
        <SchreibHinweis unter16={status.unter_16} gesperrtBis={status.gesperrt_bis} />
      )}
    </div>
  );
}
