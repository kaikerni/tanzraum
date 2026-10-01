import Link from "next/link";
import { redirect } from "next/navigation";
import { FileUp, ShieldCheck, UserPlus } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { ElternBestaetigungen } from "@/components/familie/Familie";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getMitgliederListe, getMitgliederAuswahl, getMitgliederVereine } from "@/lib/mitglieder/getMitglieder";
import { getAuswahllisten } from "@/lib/verein/getVerein";
import { MitgliederAnsicht } from "@/components/mitglieder/MitgliederAnsicht";
import { getRegister } from "@/lib/mitglieder/register";
import { basisUrl } from "@/lib/url";

export default async function MitgliederSeite({
  searchParams,
}: {
  searchParams: Promise<{ verein?: string; konto?: string }>;
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

  const { verein: gewaehlt, konto } = await searchParams;
  const mitgliedschaft = vereine.find((v) => v.vereinId === gewaehlt) ?? vereine[0];
  const vereinId = mitgliedschaft.vereinId;
  const rolle = (mitgliedschaft.rolleName ?? "").toLowerCase();
  const istAdmin = rolle.includes("admin");
  const darfGruppen = istAdmin || rolle.includes("trainer");

  const [mitglieder, auswahl, listen, { data: gruppen }, { data: funktionen }, { data: funktionsZuordnung }, { data: darfFunktionen }] = await Promise.all([
    getMitgliederListe(supabase, vereinId),
    darfGruppen ? getMitgliederAuswahl(supabase, vereinId) : Promise.resolve([]),
    getAuswahllisten(supabase),
    supabase.from("gruppen").select("id, name").eq("verein_id", vereinId).order("name"),
    supabase.from("verein_funktionen").select("id, name").eq("verein_id", vereinId).order("sortierung").order("name"),
    supabase.from("mitglied_funktionen").select("vereins_mitglied_id, funktion_id, verein_funktionen!inner(verein_id)").eq("verein_funktionen.verein_id", vereinId),
    supabase.rpc("hat_vereinsbereich", { p_verein_id: vereinId, p_bereich: "mitglieder" }),
  ]);
  // Freie Vereinsfunktionen je Mitglied (vergeben keine Rechte)
  const funktionenJeMitglied: Record<string, string[]> = {};
  for (const z of funktionsZuordnung ?? []) (funktionenJeMitglied[z.vereins_mitglied_id] ??= []).push(z.funktion_id);
  const [{ data: offeneEltern }, register, basis] = await Promise.all([
    istAdmin ? supabase.rpc("offene_eltern_bestaetigungen", { p_verein_id: vereinId }) : Promise.resolve({ data: [] }),
    istAdmin ? getRegister(supabase, vereinId) : Promise.resolve(null),
    basisUrl(),
  ]);
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
            <>
              <Link
                href={`/dashboard/mitglieder/neu?verein=${vereinId}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-[14px] font-semibold text-white hover:bg-brand-red-deep"
              >
                <UserPlus size={17} /> Mitglied anlegen
              </Link>
              <Link
                href={`/dashboard/mitglieder/import?verein=${vereinId}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[14px] font-semibold text-brand-ink hover:bg-brand-bg"
              >
                <FileUp size={17} /> Mitglieder importieren
              </Link>
            </>
          )}
        </div>
      </div>

      {istAdmin && (register ?? []).length === 0 && (
        <section className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-brand-gold/40 bg-brand-gold-wash/60 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-brand-ink">Du hast bereits eine Mitgliederliste aus einer anderen Vereinssoftware?</p>
            <p className="mt-0.5 text-[13.5px] text-brand-ink-soft">
              Dann musst du deine Mitglieder nicht einzeln anlegen. Importiere einfach deine bestehende Mitgliederliste.
            </p>
          </div>
          <Link
            href={`/dashboard/mitglieder/import?verein=${vereinId}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-ink px-4 text-[14px] font-semibold text-white"
          >
            <FileUp size={17} /> Mitglieder importieren
          </Link>
        </section>
      )}

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
        funktionen={(funktionen ?? []) as { id: string; name: string }[]}
        funktionenJeMitglied={funktionenJeMitglied}
        darfFunktionen={darfFunktionen === true}
        register={register}
        basisUrl={basis}
        kontoStart={konto === "ohne" || konto === "eingeladen" || konto === "konto" ? konto : "alle"}
      />
    </div>
  );
}
