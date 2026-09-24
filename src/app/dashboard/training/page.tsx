import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getTrainingKalender,
  getBetreuteGruppen,
  getTrainingsSerien,
  heuteBerlin,
  plusTage,
} from "@/lib/training/getTraining";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { TrainingKalender } from "@/components/training/TrainingKalender";
import { TrainingsSerien } from "@/components/training/TrainingsSerien";

export default async function TrainingSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const heute = heuteBerlin();
  const [tage, gruppen] = await Promise.all([getTrainingKalender(supabase, heute, plusTage(heute, 13)), getBetreuteGruppen(supabase)]);
  const serien = await getTrainingsSerien(
    supabase,
    gruppen.map((g) => g.gruppeId),
  );

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Training</h1>
          <p className="text-[14px] text-brand-ink-soft">Deine Trainings der nächsten zwei Wochen – hier meldest du dich (oder dein Kind) ab.</p>
        </div>
        {gruppen.length > 0 && (
          <Link
            href="/dashboard/training/neu"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
          >
            <Plus size={16} /> Training anlegen
          </Link>
        )}
      </div>

      <TrainingKalender tage={tage} heute={heute} morgen={plusTage(heute, 1)} />

      {gruppen.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={Repeat} titel="Trainingszeiten verwalten" untertitel="Alle Trainingszeiten deiner Gruppen" />
          <TrainingsSerien serien={serien} />
        </section>
      )}
    </div>
  );
}
