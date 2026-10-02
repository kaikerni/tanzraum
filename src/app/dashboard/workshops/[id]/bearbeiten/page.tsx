import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { WorkshopFormular } from "@/components/workshops/WorkshopFormular";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";
import { WORKSHOP_SPALTEN, type Workshop } from "@/lib/workshops/workshops";

export const metadata = { title: "Workshop bearbeiten – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WorkshopBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("workshops").select(WORKSHOP_SPALTEN).eq("id", id).maybeSingle();
  if (!data) notFound();
  const w = data as Workshop;
  const rechte = await meineTeamRechte(supabase);
  const darf = darfTeam(rechte, "workshops.bearbeiten") || (w.eingereicht_von === user.id && ["entwurf", "eingereicht", "abgelehnt"].includes(w.status));
  if (!darf) redirect(`/dashboard/workshops/${id}`);
  const { data: bild } = w.bild_pfad ? await supabase.storage.from("workshops").createSignedUrl(w.bild_pfad, 3600) : { data: null };
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link href={`/dashboard/workshops/${id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> Zurück zum Workshop
      </Link>
      <h1 className="text-[24px] font-extrabold tracking-tight text-brand-ink">Workshop bearbeiten</h1>
      <section className={KARTE}>
        <WorkshopFormular userId={user.id} workshop={w} bildUrl={bild?.signedUrl ?? null} />
      </section>
    </div>
  );
}
