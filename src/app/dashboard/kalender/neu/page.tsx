import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { heuteBerlin } from "@/lib/training/getTraining";
import { getMeinTarif, getTerminZiele } from "@/lib/kalender/getKalender";
import { getTurnier } from "@/lib/turniere/getTurniere";
import { KARTE } from "@/components/dashboard/Karten";
import { TerminFormular, type TerminVorgabe } from "@/components/kalender/TerminFormular";

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TerminNeuSeite({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string; verein?: string; turnier?: string; von?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tarif, ziele] = await Promise.all([getMeinTarif(supabase), getTerminZiele(supabase)]);
  const sp = await searchParams;
  const startDatum = sp.datum && DATUM.test(sp.datum) ? sp.datum : heuteBerlin();
  const privatErlaubt = tarif !== "free";
  const ausSaison = sp.von === "saison";

  // Vorlage: Vereinstermin fuer einen bestimmten Verein, optional aus einem Turnier uebernommen
  const ziel = ziele.find((z) => z.vereinId === sp.verein) ?? (ausSaison || sp.turnier ? ziele[0] : undefined);
  const turnier = ziel && sp.turnier && UUID.test(sp.turnier) ? await getTurnier(supabase, sp.turnier) : null;
  const vorlage: TerminVorgabe | undefined = ziel
    ? {
        id: "",
        vereinId: ziel.vereinId,
        art: turnier ? "turnier" : "auftritt",
        titel: turnier?.name ?? "",
        beschreibung: null,
        ort: turnier ? (turnier.adresse ?? turnier.ort).slice(0, 200) : null,
        datum: turnier?.ersterTag ?? startDatum,
        bisDatum: turnier && turnier.letzterTag > turnier.ersterTag ? turnier.letzterTag : null,
        von: turnier?.tage.find((t) => t.datum === turnier.ersterTag)?.beginn?.slice(0, 5) ?? null,
        bis: null,
        zielgruppe: "verein",
        gruppeIds: [],
        rueckmeldung: true,
        turnierId: turnier?.id ?? null,
        turnierName: turnier?.name ?? null,
      }
    : undefined;

  const zurueck = ausSaison || turnier ? "/dashboard/saisonplanung" : `/dashboard/kalender?tag=${startDatum}`;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link href={zurueck} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> {ausSaison || turnier ? "Zurück zur Saisonplanung" : "Zurück zum Kalender"}
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">{turnier ? "Turnier in die Saisonplanung übernehmen" : "Termin anlegen"}</h1>
      <section className={KARTE}>
        {!privatErlaubt && ziele.length === 0 ? (
          <p className="text-[14px] text-brand-ink-soft">Eigene Termine sind ab dem Tarif BASIC enthalten.</p>
        ) : (
          <TerminFormular ziele={ziele} privatErlaubt={privatErlaubt} startDatum={startDatum} vorgabe={vorlage} />
        )}
      </section>
    </div>
  );
}
