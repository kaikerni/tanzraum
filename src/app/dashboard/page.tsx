import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getMeineBereiche } from "@/lib/dashboard/getBereiche";
import {
  getKennzahlen,
  getNaechsteTermine,
  getNaechsteTurniere,
  getAltersklassen,
  getHeute,
  getBeteiligungVerlauf,
  getRadar,
} from "@/lib/dashboard/getDashboardUebersicht";
import { getAktuelleNachrichten } from "@/lib/dashboard/getNachrichten";
import { ZEITRAEUME } from "@/components/dashboard/ZeitraumAuswahl";
import { DashboardAnsicht } from "@/components/dashboard/DashboardAnsicht";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ wochen?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  if (daten.gesperrt) redirect("/gesperrt");

  const { wochen: wochenParam } = await searchParams;
  const wochen = ZEITRAEUME.find((w) => String(w) === wochenParam) ?? 8;

  const [bereiche, kennzahlen, termine, turniere, altersklassen, heute, verlauf, radar, nachrichten] =
    await Promise.all([
      getMeineBereiche(supabase, daten.istPlattformAdmin),
      getKennzahlen(supabase),
      getNaechsteTermine(supabase, 6),
      getNaechsteTurniere(supabase, 4),
      getAltersklassen(supabase),
      getHeute(supabase),
      getBeteiligungVerlauf(supabase, wochen),
      getRadar(supabase),
      getAktuelleNachrichten(supabase, user.id, 4),
    ]);

  return (
    <DashboardAnsicht
      daten={daten}
      bereiche={bereiche}
      kennzahlen={kennzahlen}
      termine={termine}
      turniere={turniere}
      altersklassen={altersklassen}
      heute={heute}
      verlauf={verlauf}
      radar={radar}
      nachrichten={nachrichten}
      wochen={wochen}
    />
  );
}
