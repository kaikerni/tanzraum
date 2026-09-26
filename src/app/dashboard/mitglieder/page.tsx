import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, UserPlus } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { ElternBestaetigungen } from "@/components/familie/Familie";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getMitgliederListe, getMitgliederAuswahl, getMitgliederVereine } from "@/lib/mitglieder/getMitglieder";
import { getAuswahllisten } from "@/lib/verein/getVerein";
import { MitgliederAnsicht } from "@/components/mitglieder/MitgliederAnsicht";

export default async function MitgliederSeite({
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

  // Nur Vereine mit Vereinslizenz, in denen man Vereinsadmin ist oder den Bereich "mitglieder" hat.
  const erlaubt = await getMitgliederVereine(supabase);
  const vereine = daten.vereine.filter((v) => erlaubt.has(v.vereinId));

  if (vereine.length === 0) {
    return (
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mitglieder</h1>
        <p className="mt-2 rounded-[var(--radius-l)] border border-brand-line bg-white p-5 text-[14px] text-brand-ink-soft shadow-[var(--shadow)]">
          Die Mitgliederliste sehen Vereinsadmins, Trainer und Betreuer eines Vereins mit Vereinslizenz – bzw. wer den
          Bereich „Mitglieder“ vom Vereinsadmin freigeschaltet bekommen hat.
        </p>
      </div>
    );
  }

  const { verein: gewaehlt } = await searchParams;
  const mitgliedschaft = vereine.find((v) => v.vereinId === gewaehlt) ?? vereine[0];
  const vereinId = mitgliedschaft.vereinId;
  const rolle = (mitgliedschaft.rolleName ?? "").toLowerCase();
  const istAdmin = rolle.includes("admin");
  const darfGruppen = istAdmin || rolle.includes("trainer");

  const [mitglieder, auswahl, listen, { data: gruppen }] = await Promise.all([
    getMitgliederListe(supabase, vereinId),
    darfGruppen ? getMitgliederAuswahl(supabase, vereinId) : Promise.resolve([]),
    getAuswahllisten(supabase),
    supabase.from("gruppen").select("id, name").eq("verein_id", vereinId).order("name"),
  ]);
  const { data: offeneEltern } = istAdmin ? await supabase.rpc("offene_eltern_bestaetigungen", { p_verein_id: vereinId }) : { data: [] };
  if (mitglieder === null) redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mitglieder</h1>
          <p className="text-[14px] text-brand-ink-soft">
            {mitgliedschaft.vereinName} ·{" "}
            {istAdmin ? "Vollständige Verwaltung" : darfGruppen ? "Mitglieder deiner Gruppen" : "Mitglieder deiner Gruppen (nur ansehen)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {vereine.length > 1 &&
            vereine.map((v) => (
              <Link
                key={v.vereinId}
                href={`/dashboard/mitglieder?verein=${v.vereinId}`}
                aria-current={v.vereinId === vereinId ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                  v.vereinId === vereinId ? "border-brand-red bg-brand-red text-white" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"
                }`}
              >
                {v.vereinName}
              </Link>
            ))}
          {istAdmin && (
            <Link
              href={`/dashboard/mitglieder/neu?verein=${vereinId}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
            >
              <UserPlus size={16} /> Mitglied hinzufügen
            </Link>
          )}
        </div>
      </div>

      {(offeneEltern ?? []).length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={ShieldCheck} titel="Eltern-Verknüpfungen bestätigen" untertitel="Bitte nur bestätigen, wenn es wirklich Mutter oder Vater des Mitglieds ist." />
          <ElternBestaetigungen offen={(offeneEltern as any[]).map((o) => ({ id: o.id, eltern: o.eltern, kind: o.kind }))} />
        </section>
      )}

      <MitgliederAnsicht
        vereinId={vereinId}
        mitglieder={mitglieder}
        rollen={listen.rollen}
        gruppen={(gruppen ?? []) as { id: string; name: string }[]}
        auswahl={auswahl}
        istAdmin={istAdmin}
        darfGruppen={darfGruppen}
      />
    </div>
  );
}
