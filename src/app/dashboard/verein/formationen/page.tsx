import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getMitgliederListe } from "@/lib/mitglieder/getMitglieder";
import { getDisziplinen, getFormationen } from "@/lib/verein/formationen";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { FormationenVerwaltung } from "@/components/verein/FormationenVerwaltung";

export const metadata = { title: "Formationen – TanzRaum" };

// Formationen: konkrete Besetzungen einer Disziplin (Tanzpaar, Solist, Garde, Schautanz) – getrennt von Vereinsgruppen.
export default async function FormationenSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten || daten.vereine.length === 0) redirect("/dashboard/verein");
  const { verein: gewaehlt } = await searchParams;
  const mitgliedschaft = daten.vereine.find((v) => v.vereinId === gewaehlt) ?? daten.vereine[0];
  const vereinId = mitgliedschaft.vereinId;
  const rolle = (mitgliedschaft.rolleName ?? "").toLowerCase();
  // Nur Anzeige: die Datenbank erlaubt Aenderungen ausschliesslich Vereinsadmins und Trainern
  const darfVerwalten = rolle.includes("admin") || rolle.includes("trainer");

  const [mitglieder, { disziplinen, erlaubt }, { data: altersklassen }, { data: gruppen }] = await Promise.all([
    getMitgliederListe(supabase, vereinId),
    getDisziplinen(supabase),
    supabase.from("altersklassen").select("id, name").order("sortierung"),
    supabase.from("gruppen").select("id, name").eq("verein_id", vereinId).order("name"),
  ]);
  const namen = new Map((mitglieder ?? []).map((m) => [m.vmId, m.name]));
  const formationen = await getFormationen(supabase, vereinId, namen);

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <Link href={`/dashboard/verein?verein=${vereinId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Mein Verein
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Formationen</h1>
        <p className="text-[14px] text-brand-ink-soft">{mitgliedschaft.vereinName}</p>
      </div>
      <section className={KARTE}>
        <KarteKopf
          icon={Users2}
          titel="Besetzungen je Disziplin"
          untertitel="Eine Formation ist die konkrete Besetzung einer Disziplin, z. B. ein Tanzpaar oder ein Solist. Die Personen bleiben ganz normale Vereinsmitglieder; Vereinsgruppen bleiben davon unberührt."
        />
        <FormationenVerwaltung
          vereinId={vereinId}
          formationen={formationen}
          darfVerwalten={darfVerwalten}
          mitglieder={(mitglieder ?? []).map((m) => ({ id: m.vmId, name: m.name }))}
          disziplinen={disziplinen}
          altersklassen={(altersklassen ?? []) as { id: string; name: string }[]}
          erlaubt={Object.fromEntries([...erlaubt.entries()].map(([k, v]) => [k, [...v]]))}
          gruppen={((gruppen ?? []) as { id: string; name: string | null }[]).map((g) => ({ id: g.id, name: g.name ?? "Gruppe" }))}
        />
      </section>
    </div>
  );
}
