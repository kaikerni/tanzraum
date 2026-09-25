import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBetreuteGruppen, heuteBerlin } from "@/lib/training/getTraining";
import { KARTE } from "@/components/dashboard/Karten";
import { TrainingFormular } from "@/components/training/TrainingFormular";

export default async function TrainingNeuSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const gruppen = await getBetreuteGruppen(supabase);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <Link href="/dashboard/training" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zurück zum Training
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Training anlegen</h1>
      <section className={KARTE}>
        {gruppen.length === 0 ? (
          <p className="text-[14px] text-brand-ink-soft">
            Trainings anlegen dürfen Vereinsadmins und die Trainer einer Gruppe. Du bist aktuell keiner Gruppe als Trainer
            zugeordnet – oder im Verein gibt es noch keine Gruppen (unter „Mein Verein“ anlegen).
          </p>
        ) : (
          <TrainingFormular gruppen={gruppen} heute={heuteBerlin()} />
        )}
      </section>
    </div>
  );
}
