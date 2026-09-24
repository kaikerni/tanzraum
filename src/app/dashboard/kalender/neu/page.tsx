import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { heuteBerlin } from "@/lib/training/getTraining";
import { getMeinTarif, getTerminZiele } from "@/lib/kalender/getKalender";
import { KARTE } from "@/components/dashboard/Karten";
import { TerminFormular } from "@/components/kalender/TerminFormular";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export default async function TerminNeuSeite({ searchParams }: { searchParams: Promise<{ datum?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tarif, ziele] = await Promise.all([getMeinTarif(supabase), getTerminZiele(supabase)]);
  const { datum } = await searchParams;
  const startDatum = datum && DATUM.test(datum) ? datum : heuteBerlin();
  const privatErlaubt = tarif !== "free";

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link
        href={`/dashboard/kalender?tag=${startDatum}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink"
      >
        <ArrowLeft size={15} /> Zurück zum Kalender
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Termin anlegen</h1>
      <section className={KARTE}>
        {!privatErlaubt && ziele.length === 0 ? (
          <p className="text-[14px] text-brand-ink-soft">Eigene Termine sind ab dem Tarif BASIC enthalten.</p>
        ) : (
          <TerminFormular ziele={ziele} privatErlaubt={privatErlaubt} startDatum={startDatum} />
        )}
      </section>
    </div>
  );
}
