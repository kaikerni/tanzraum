import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOeffentlicheUpdates } from "@/lib/updates/getUpdates";
import { UpdateKarte } from "@/components/updates/UpdateKarte";
import { RechtsLinks } from "@/components/recht/RechtsLinks";
import { versionText } from "@/lib/version";

export const metadata = {
  title: "Neu bei TanzRaum",
  description: "Neue Funktionen und Verbesserungen in TanzRaum – der Plattform für Tanzsport und Vereine.",
  alternates: { canonical: "/neu" },
};

// Oeffentliche Neuigkeiten (Landingpage „Mehr erfahren“). Nur von der TanzRaum-Administration freigegebene Eintraege.
export default async function NeuSeite() {
  const supabase = await createClient();
  const liste = await getOeffentlicheUpdates(supabase, 30);
  return (
    <div className="min-h-screen bg-brand-bg px-4 py-8">
      <div className="mx-auto flex max-w-[820px] flex-col gap-5">
        <Link href="/" className="w-fit">
          <Image src="/tanzraum-logo-header.webp" alt="TanzRaum" width={1392} height={207} className="h-9 w-auto" />
        </Link>
        <div>
          <p className="inline-flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.12em] text-brand-red">
            <Sparkles size={15} /> Neu bei TanzRaum
          </p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-brand-ink">Neue Funktionen und Verbesserungen</h1>
          <p className="mt-1 text-[14px] text-brand-ink-soft">
            TanzRaum ist eine Web-App: Neue Versionen erhältst du automatisch beim nächsten Laden – ohne Download oder Neuinstallation.
          </p>
        </div>
        {liste.length === 0 ? (
          <p className="rounded-[var(--radius-l)] border border-brand-line bg-white p-5 text-[14px] text-brand-ink-soft">Bald gibt es hier Neuigkeiten.</p>
        ) : (
          liste.map((u) => <UpdateKarte key={u.id} u={u} ausfuehrlich />)
        )}
        <p className="text-[12px] text-brand-ink-faint">{versionText()}</p>
        <RechtsLinks />
      </div>
    </div>
  );
}
