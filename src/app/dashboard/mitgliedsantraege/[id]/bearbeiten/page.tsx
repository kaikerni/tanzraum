import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAntragFormular } from "@/lib/antraege/getAntraege";
import { AntragFormular } from "@/components/antraege/AntragFormular";

export const metadata = { title: "Mitgliedsantrag bearbeiten – TanzRaum" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Der Verein korrigiert bzw. ergaenzt die Angaben (z. B. nach Papierantrag). Unterschriften bleiben unveraendert.
export default async function AntragBearbeitenSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/mitgliedsantraege/${id}`);
  const a = await getAntragFormular(supabase, id);
  if (!a) notFound();
  if (!a.darfVerwalten) redirect(`/dashboard/mitgliedsantrag/${id}`);

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4">
      <Link href={`/dashboard/mitgliedsantraege/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zurück zum Antrag
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Angaben bearbeiten</h1>
        <p className="text-[13.5px] text-brand-ink-soft">Änderungen werden am Antrag gespeichert. Unterschriften und Einreichungsdatum bleiben unverändert.</p>
      </div>
      <AntragFormular
        antragId={a.id}
        modus="verwaltung"
        vereinName={a.verein.name}
        logoUrl={a.verein.logo_url}
        inhalt={a.inhalt}
        start={a.daten}
        erlaubteVerfahren={a.erlaubteVerfahren}
        heute={new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })}
      />
    </div>
  );
}
