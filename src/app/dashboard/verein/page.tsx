import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import {
  getVereinsDetails,
  getVereinUebersicht,
  getAuswahllisten,
  getOffeneEinladungen,
} from "@/lib/verein/getVerein";
import { basisUrl } from "@/lib/url";
import { OhneVerein } from "@/components/verein/OhneVerein";
import { VereinAnsicht } from "@/components/verein/VereinAnsicht";

export default async function MeinVereinSeite({
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

  if (daten.vereine.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mein Verein</h1>
          <p className="text-[14px] text-brand-ink-soft">Du bist noch in keinem Verein Mitglied.</p>
        </div>
        <OhneVerein />
      </div>
    );
  }

  const { verein: gewaehlt } = await searchParams;
  const mitgliedschaft = daten.vereine.find((v) => v.vereinId === gewaehlt) ?? daten.vereine[0];
  const vereinId = mitgliedschaft.vereinId;
  const rolle = (mitgliedschaft.rolleName ?? "").toLowerCase();
  const istAdmin = rolle.includes("admin");
  const darfGruppen = istAdmin || rolle.includes("trainer");

  const [verein, uebersicht, auswahl, einladungen, basis] = await Promise.all([
    getVereinsDetails(supabase, vereinId),
    getVereinUebersicht(supabase, vereinId),
    getAuswahllisten(supabase),
    istAdmin ? getOffeneEinladungen(supabase, vereinId) : Promise.resolve([]),
    basisUrl(),
  ]);
  if (!verein || !uebersicht) redirect("/dashboard");

  return (
    <VereinAnsicht
      vereine={daten.vereine}
      vereinId={vereinId}
      verein={verein}
      uebersicht={uebersicht}
      auswahl={auswahl}
      einladungen={einladungen}
      basis={basis}
      istAdmin={istAdmin}
      darfGruppen={darfGruppen}
    />
  );
}
