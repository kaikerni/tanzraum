import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getMitgliederListe } from "@/lib/mitglieder/getMitglieder";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { FunktionenVerwaltung, type VereinsFunktion } from "@/components/verein/FunktionenVerwaltung";

export const metadata = { title: "Vereinsfunktionen – TanzRaum" };

export default async function FunktionenSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
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

  const [{ data: darf }, mitglieder, { data: funktionen }] = await Promise.all([
    supabase.rpc("hat_vereinsbereich", { p_verein_id: vereinId, p_bereich: "mitglieder" }),
    getMitgliederListe(supabase, vereinId),
    supabase.from("verein_funktionen").select("id, name, mitglied_funktionen(vereins_mitglied_id)").eq("verein_id", vereinId).order("name"),
  ]);
  const namen = new Map((mitglieder ?? []).map((m) => [m.vmId, m.name]));
  // deno-lint-ignore no-explicit-any
  const liste: VereinsFunktion[] = ((funktionen ?? []) as any[]).map((f) => ({
    id: f.id,
    name: f.name,
    // deno-lint-ignore no-explicit-any
    mitglieder: (f.mitglied_funktionen ?? []).map((m: any) => ({ id: m.vereins_mitglied_id, name: namen.get(m.vereins_mitglied_id) ?? "Mitglied" })),
  }));

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href={`/dashboard/verein?verein=${vereinId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Mein Verein
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Vereinsfunktionen</h1>
        <p className="text-[14px] text-brand-ink-soft">{mitgliedschaft.vereinName}</p>
      </div>
      <section className={KARTE}>
        <KarteKopf
          icon={BadgeCheck}
          titel="Funktionen im Verein"
          untertitel="Zusätzliche Funktionen wie Vorstand, Hästräger oder Musiker. Sie beschreiben Aufgaben im Verein und vergeben keine Rechte – die Rechte hängen weiter an der Rolle (Vereinsadmin, Trainer, Betreuer, Mitglied, Eltern)."
        />
        <FunktionenVerwaltung
          vereinId={vereinId}
          funktionen={liste}
          mitglieder={(mitglieder ?? []).map((m) => ({ id: m.vmId, name: m.name }))}
          darfVerwalten={darf === true}
        />
      </section>
    </div>
  );
}
