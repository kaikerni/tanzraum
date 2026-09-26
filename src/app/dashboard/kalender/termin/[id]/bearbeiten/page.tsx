import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTermin, getTerminZiele } from "@/lib/kalender/getKalender";
import { KARTE } from "@/components/dashboard/Karten";
import { TerminFormular } from "@/components/kalender/TerminFormular";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function TerminBearbeitenSeite({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [termin, { data: roh }] = await Promise.all([
    getTermin(supabase, id),
    supabase.from("termine").select("gruppe_ids").eq("id", id).maybeSingle(),
  ]);
  if (!termin || !roh) notFound();
  if (!termin.darfBearbeiten) redirect(`/dashboard/kalender/termin/${id}`);

  const ziele = termin.vereinId ? (await getTerminZiele(supabase)).filter((z) => z.vereinId === termin.vereinId) : [];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link
        href={`/dashboard/kalender/termin/${id}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink"
      >
        <ArrowLeft size={15} /> Zurück zum Termin
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Termin bearbeiten</h1>
      <section className={KARTE}>
        <TerminFormular
          ziele={ziele}
          privatErlaubt={termin.vereinId === null}
          startDatum={termin.datum}
          vorgabe={{
            id: termin.id,
            vereinId: termin.vereinId,
            art: termin.art,
            titel: termin.titel,
            beschreibung: termin.beschreibung,
            ort: termin.ort,
            datum: termin.datum,
            bisDatum: termin.bisDatum,
            von: termin.von,
            bis: termin.bis,
            zielgruppe: termin.zielgruppe,
            gruppeIds: (roh.gruppe_ids as string[]) ?? [],
            rueckmeldung: termin.rueckmeldung,
          }}
        />
      </section>
    </div>
  );
}
