import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Repeat, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getTrainingKalender,
  getBetreuteGruppen,
  getTrainingsSerien,
  heuteBerlin,
  plusTage,
} from "@/lib/training/getTraining";
import { getZugriff } from "@/lib/dashboard/getBereiche";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { TrainingKalender } from "@/components/training/TrainingKalender";
import { TrainingsSerien } from "@/components/training/TrainingsSerien";
import { AbmeldeHinweiseGelesen } from "@/components/training/AbmeldeHinweiseGelesen";

export default async function TrainingSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Training & Abmeldung ist Teil der Vereinslizenz (die Datenbank liefert ohne Lizenz ohnehin keine Termine)
  const { data: istPlattformAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  const zugriff = await getZugriff(supabase, istPlattformAdmin === true);
  if (!zugriff.istPlattformAdmin && zugriff.tarif !== "verein") {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Training</h1>
        <section className={`${KARTE} flex flex-col items-center gap-3 py-10 text-center`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-bg text-brand-ink-soft">
            <Lock size={26} />
          </div>
          <p className="text-[16px] font-bold text-brand-ink">Teil der Vereinslizenz</p>
          <p className="max-w-md text-[14px] text-brand-ink-soft">
            Trainingstermine und Abmeldungen gibt es für Mitglieder eines Vereins mit Vereinslizenz. Der Vereinsadmin kann sie unter
            „Mein Tarif“ buchen.
          </p>
          <Link href="/dashboard/tarif" className="mt-2 text-[13.5px] font-semibold text-brand-red">
            Zu „Mein Tarif“
          </Link>
        </section>
      </div>
    );
  }

  const heute = heuteBerlin();
  const [tage, gruppen, { count: neueAbmeldungen }] = await Promise.all([
    getTrainingKalender(supabase, heute, plusTage(heute, 13)),
    getBetreuteGruppen(supabase),
    supabase
      .from("benachrichtigungen")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("typ", "training_abmeldung")
      .eq("gelesen", false),
  ]);
  const serien = await getTrainingsSerien(
    supabase,
    gruppen.map((g) => g.gruppeId),
  );

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <AbmeldeHinweiseGelesen anzahl={neueAbmeldungen ?? 0} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Training</h1>
          <p className="text-[14px] text-brand-ink-soft">
            Du bist automatisch eingeplant. Wenn du (oder dein Kind) nicht kommen kannst, meldest du dich hier für den einzelnen Termin ab.
          </p>
        </div>
        {gruppen.length > 0 && (
          <Link
            href="/dashboard/training/neu"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white hover:bg-brand-navy"
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
