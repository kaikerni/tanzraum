import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getVereinsDetails, getAuswahllisten } from "@/lib/verein/getVerein";
import { KARTE } from "@/components/dashboard/Karten";
import { VereinsdatenFormular } from "@/components/verein/VereinsdatenFormular";

export default async function VereinBearbeitenSeite({
  searchParams,
}: {
  searchParams: Promise<{ verein?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");

  // Nur Vereine, in denen der Nutzer Vereinsadmin ist (RLS erzwingt das beim Speichern ohnehin).
  const { verein: gewaehlt } = await searchParams;
  const adminVereine = daten.vereine.filter((v) => (v.rolleName ?? "").toLowerCase().includes("admin"));
  const mitgliedschaft = adminVereine.find((v) => v.vereinId === gewaehlt) ?? adminVereine[0];
  if (!mitgliedschaft) redirect("/dashboard/verein");

  const [verein, auswahl] = await Promise.all([
    getVereinsDetails(supabase, mitgliedschaft.vereinId),
    getAuswahllisten(supabase),
  ]);
  if (!verein) redirect("/dashboard/verein");

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4">
      <Link
        href={`/dashboard/verein?verein=${verein.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink"
      >
        <ArrowLeft size={15} /> Zurück zu Mein Verein
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Vereinsdaten bearbeiten</h1>
        <p className="text-[14px] text-brand-ink-soft">{verein.name}</p>
      </div>
      <section className={KARTE}>
        <VereinsdatenFormular verein={verein} verbaende={auswahl.verbaende} />
      </section>
    </div>
  );
}
