import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPlanungsVereine } from "@/lib/turniere/getTurniere";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { VereinsturnierFormular } from "@/components/turniere/VereinsturnierFormular";

export const metadata = { title: "Vereinsturnier anlegen – TanzRaum" };

export default async function NeuesVereinsturnierSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/turniere/neu");

  const planung = await getPlanungsVereine(supabase);
  if (planung.length === 0) redirect("/dashboard/turniere");
  const { verein } = await searchParams;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <Link href="/dashboard/turniere" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Alle Turniere
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Vereinsturnier anlegen</h1>
      <section className={KARTE}>
        <KarteKopf
          icon={Trophy}
          titel="Turnier, das noch nicht im Turnierkalender steht"
          untertitel="Zum Beispiel ein Freundschaftsturnier oder ein Workshop. Danach kannst du direkt Starts einplanen."
        />
        <VereinsturnierFormular vereine={planung} vorauswahl={verein} />
      </section>
    </div>
  );
}
