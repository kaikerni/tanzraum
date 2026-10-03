import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { AngebotFormular } from "@/components/boerse/AngebotFormular";
import { bilderSignieren, getKategorien, type Angebot } from "@/lib/boerse";
import { HandelnHinweis } from "@/components/boerse/HandelnHinweis";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Angebot bearbeiten – TanzRaum Börse" };

export default async function AngebotBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/boerse/${id}/bearbeiten`);
  const [{ data }, kategorien, { data: grund }] = await Promise.all([
    supabase.rpc("boerse_angebot", { p_id: id }),
    getKategorien(supabase),
    supabase.rpc("boerse_darf_handeln"),
  ]);
  const a = data as Angebot | null;
  if (!a || !a.ist_meins) notFound();
  if (a.status === "gesperrt") redirect(`/dashboard/boerse/${id}`);
  const urls = await bilderSignieren(supabase, a.bilder);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href={`/dashboard/boerse/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zum Angebot
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Angebot bearbeiten</h1>
      {grund ? (
        <HandelnHinweis grund={String(grund)} />
      ) : (
        <section className={KARTE}>
          <AngebotFormular userId={user.id} kategorien={kategorien} angebot={a} bildUrls={Object.fromEntries(urls)} />
        </section>
      )}
    </div>
  );
}
