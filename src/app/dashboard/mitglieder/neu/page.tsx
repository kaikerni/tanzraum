import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Ticket, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getAuswahllisten, getOffeneEinladungen } from "@/lib/verein/getVerein";
import { basisUrl } from "@/lib/url";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EinladungsVerwaltung } from "@/components/verein/EinladungsVerwaltung";
import { PersonHinzufuegen } from "@/components/antraege/VereinsAktionen";

// Mitglieder kommen in den Verein: Person mit TanzRaum-Konto direkt hinzufuegen oder per Einladungslink
// (Registrierung). Je nach Vereinseinstellung sind sie danach "neu" und fuellen den Mitgliedsantrag aus.
export default async function MitgliedHinzufuegenSeite({
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

  const { verein: gewaehlt } = await searchParams;
  const adminVereine = daten.vereine.filter((v) => (v.rolleName ?? "").toLowerCase().includes("admin"));
  const mitgliedschaft = adminVereine.find((v) => v.vereinId === gewaehlt) ?? adminVereine[0];
  if (!mitgliedschaft) redirect("/dashboard/mitglieder");

  const [listen, einladungen, { data: gruppen }, basis] = await Promise.all([
    getAuswahllisten(supabase),
    getOffeneEinladungen(supabase, mitgliedschaft.vereinId),
    supabase.from("gruppen").select("id, name").eq("verein_id", mitgliedschaft.vereinId).order("name"),
    basisUrl(),
  ]);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href={`/dashboard/mitglieder?verein=${mitgliedschaft.vereinId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zurück zu den Mitgliedern
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mitglied hinzufügen</h1>
        <p className="text-[14px] text-brand-ink-soft">{mitgliedschaft.vereinName}</p>
      </div>
      <section className={KARTE}>
        <KarteKopf
          icon={UserPlus}
          titel="Person mit TanzRaum-Konto hinzufügen"
          untertitel="Per E-Mail-Adresse oder @Handle. Ist die Person einem anderen Verein zugeordnet, bitten wir diesen um Freigabe."
        />
        <PersonHinzufuegen
          vereinId={mitgliedschaft.vereinId}
          rollen={listen.rollen.filter((r) => !/admin/i.test(r.name))}
          gruppen={(gruppen ?? []).map((g) => ({ id: g.id, name: g.name ?? "Gruppe" }))}
        />
      </section>
      <section className={KARTE}>
        <KarteKopf
          icon={Ticket}
          titel="Per Einladungslink"
          untertitel="Für Personen ohne TanzRaum-Konto: Sie registriert sich, öffnet den Link und füllt – falls euer Verein das verlangt – den Mitgliedsantrag aus."
        />
        <EinladungsVerwaltung
          vereinId={mitgliedschaft.vereinId}
          rollen={listen.rollen}
          gruppen={(gruppen ?? []).map((g) => ({ id: g.id, name: g.name ?? "Gruppe" }))}
          einladungen={einladungen}
          basisUrl={basis}
        />
      </section>
    </div>
  );
}
