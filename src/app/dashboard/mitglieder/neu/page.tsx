import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getAuswahllisten, getOffeneEinladungen } from "@/lib/verein/getVerein";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EinladungsVerwaltung } from "@/components/verein/EinladungsVerwaltung";

// Mitglieder kommen per Einladungslink in den Verein (eigenes TanzRaum-Konto, Rolle vom Vereinsadmin vorgegeben).
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

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const [listen, einladungen] = await Promise.all([
    getAuswahllisten(supabase),
    getOffeneEinladungen(supabase, mitgliedschaft.vereinId),
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
          icon={Ticket}
          titel="Per Einladungslink"
          untertitel="Die Person registriert sich (oder meldet sich an), öffnet den Link und ist dann mit der gewählten Rolle Mitglied. Danach kannst du sie Gruppen zuordnen und mit Eltern verknüpfen."
        />
        <EinladungsVerwaltung
          vereinId={mitgliedschaft.vereinId}
          rollen={listen.rollen}
          einladungen={einladungen}
          basisUrl={`${proto}://${host}`}
        />
      </section>
    </div>
  );
}
