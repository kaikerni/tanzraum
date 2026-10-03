import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { WissenEditor } from "@/components/wissen/WissenEditor";
import { kategorienListe } from "@/lib/treff/laden";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";
import { WISSEN_SPALTEN, type WissenArtikel } from "@/lib/wissen";

export const metadata = { title: "Wissensbeitrag bearbeiten – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WissenBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const rechte = await meineTeamRechte(supabase);
  if (!darfTeam(rechte, "wissen.bearbeiten")) redirect(`/dashboard/treff/wissen/${id}`);
  const { data } = await supabase.from("wissen_artikel").select(WISSEN_SPALTEN).eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as WissenArtikel;
  const [kategorien, { data: bild }] = await Promise.all([
    kategorienListe(supabase),
    a.bild_pfad ? supabase.storage.from("wissen").createSignedUrl(a.bild_pfad, 3600) : Promise.resolve({ data: null }),
  ]);
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4">
      <Link href={`/dashboard/treff/wissen/${id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> Zurück
      </Link>
      <h1 className="text-[24px] font-extrabold tracking-tight text-brand-ink">Wissensbeitrag bearbeiten</h1>
      <section className={KARTE}>
        <WissenEditor userId={user.id} kategorien={kategorien} artikel={a} bildUrl={bild?.signedUrl ?? null} />
      </section>
    </div>
  );
}
