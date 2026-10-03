import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAntragsVereine, getVorlage } from "@/lib/antraege/getAntraege";
import { VorlageEditor } from "@/components/antraege/VorlageEditor";

export const metadata = { title: "Mitgliedsantrag einstellen – TanzRaum" };

export default async function FormularSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/mitgliedsantraege/formular");

  const vereine = await getAntragsVereine(supabase);
  const { verein: gewaehlt } = await searchParams;
  const verein = vereine.find((v) => v.vereinId === gewaehlt) ?? vereine[0];
  if (!verein) redirect("/dashboard/mitgliedsantraege");
  const vorlage = await getVorlage(supabase, verein.vereinId);
  if (!vorlage) redirect("/dashboard/mitgliedsantraege");
  const logo = vorlage.verein.logo_url ?? "";

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href={`/dashboard/mitgliedsantraege?verein=${verein.vereinId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zurück zu den Mitgliedsanträgen
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mitgliedsantrag einstellen</h1>
        <p className="text-[14px] text-brand-ink-soft">
          {verein.vereinName} · Alle Bereiche sind mit Beispieltext vorbelegt und für euren Verein anpassbar.
          {!vorlage.gespeichert && " Noch nicht gespeichert – bis dahin gelten die Beispieltexte."}
        </p>
      </div>
      <VorlageEditor
        vereinId={verein.vereinId}
        vereinName={verein.vereinName}
        hatLogo={!!logo}
        logoPasst={/\.(png|jpe?g)(\?|$)/i.test(logo)}
        gruppen={vorlage.gruppen}
        start={vorlage.inhalt}
        startEinstellungen={vorlage.einstellungen}
      />
    </div>
  );
}
