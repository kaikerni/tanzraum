import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users, Repeat, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuswahllisten, getDisziplinInfos, getVereinUebersicht } from "@/lib/verein/getVerein";
import { getBetreuteGruppen, getTrainingsSerien } from "@/lib/training/getTraining";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { TrainingsSerien } from "@/components/training/TrainingsSerien";
import { GruppeAktionen } from "@/components/verein/GruppeAktionen";
import { staerkeText } from "@/lib/verein/gruppen";

const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Liste({ titel, namen, leer }: { titel: string; namen: string[]; leer: string }) {
  return (
    <div className="min-w-0">
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-brand-ink-soft">
        {titel} ({namen.length})
      </h3>
      {namen.length === 0 ? (
        <p className="mt-1 text-[13.5px] text-brand-ink-soft">{leer}</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {namen.map((n, i) => (
            <li key={`${n}-${i}`} className="text-[14px] text-brand-ink [overflow-wrap:anywhere]">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Gruppe öffnen: Überblick, Personen, Trainingszeiten; Ändern nur für Vereinsadmin/Trainer (Rechte prüft die Datenbank)
export default async function GruppeSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: g } = await supabase.from("gruppen").select("id, verein_id").eq("id", id).maybeSingle();
  if (!g) notFound();
  const vereinId = g.verein_id as string;

  const [uebersicht, { data: darf }, auswahl, disziplinen, betreut, serien] = await Promise.all([
    getVereinUebersicht(supabase, vereinId),
    supabase.rpc("is_verein_admin_oder_trainer", { p_verein_id: vereinId }),
    getAuswahllisten(supabase),
    getDisziplinInfos(supabase),
    getBetreuteGruppen(supabase),
    getTrainingsSerien(supabase, [id]),
  ]);
  const gruppe = uebersicht?.gruppen.find((x) => x.id === id);
  if (!uebersicht || !gruppe) notFound();
  const darfVerwalten = darf === true;
  const darfTraining = betreut.some((b) => b.gruppeId === id);

  // Namen der Tänzer nur für Vereinsadmin/Trainer (gleiche Freigabe wie die Mitgliederauswahl)
  let taenzer: string[] = [];
  if (darfVerwalten) {
    const [{ data: personen }, { data: besetzung }] = await Promise.all([
      supabase.rpc("gruppe_assistent_personen", { p_verein_id: vereinId }),
      supabase.from("gruppen_mitglieder").select("vereins_mitglied_id, funktion").eq("gruppe_id", id),
    ]);
    const namen = new Map(((personen ?? []) as { vm_id: string; name: string }[]).map((p) => [p.vm_id, p.name]));
    taenzer = ((besetzung ?? []) as { vereins_mitglied_id: string; funktion: string | null }[])
      .filter((b) => !b.funktion || b.funktion === "mitglied")
      .map((b) => namen.get(b.vereins_mitglied_id) ?? "Mitglied")
      .sort((a, b) => a.localeCompare(b, "de"));
  }
  const freie = [...new Set(uebersicht.gruppen.map((x) => x.altersklasseFrei).filter((x): x is string => !!x))].sort();
  const tanzWort = gruppe.besetzung === "paar" || gruppe.besetzung === "solo" ? "Teilnehmer" : "Tänzer";

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/verein" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Mein Verein
      </Link>
      <section className={KARTE}>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-brand-ink [overflow-wrap:anywhere]">{gruppe.name}</h1>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
          <dt className="text-brand-ink-soft">Altersklasse</dt>
          <dd className="font-semibold text-brand-ink">{gruppe.altersklasse ?? "–"}</dd>
          <dt className="text-brand-ink-soft">Disziplin</dt>
          <dd className="font-semibold text-brand-ink">{gruppe.disziplin ?? "–"}</dd>
          <dt className="text-brand-ink-soft">Gruppenstärke</dt>
          <dd className="font-semibold text-brand-ink">{staerkeText(gruppe)}</dd>
        </dl>
        {darfVerwalten && (
          <div className="mt-4">
            <GruppeAktionen vereinId={vereinId} gruppe={gruppe} altersklassen={auswahl.altersklassen} disziplinen={disziplinen} freieAltersklassen={freie} />
          </div>
        )}
      </section>

      <section className={KARTE}>
        <KarteKopf icon={Users} titel="Personen" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {darfVerwalten ? (
            <Liste titel={tanzWort} namen={taenzer} leer="Noch niemand zugeordnet." />
          ) : (
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-wide text-brand-ink-soft">{tanzWort}</h3>
              <p className="mt-1 text-[14px] text-brand-ink">{staerkeText(gruppe)}</p>
            </div>
          )}
          <Liste titel="Trainer" namen={gruppe.trainer} leer="Noch kein Trainer." />
          <Liste titel="Betreuer" namen={gruppe.betreuer} leer="Kein Betreuer." />
        </div>
      </section>

      <section className={KARTE}>
        <KarteKopf icon={Repeat} titel="Training" untertitel="Trainingszeiten dieser Gruppe – Abmeldungen und Anwesenheit laufen darüber." />
        {serien.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Trainingszeit eingetragen.</p>
        ) : darfTraining ? (
          <TrainingsSerien serien={serien} />
        ) : (
          <ul className="flex flex-col gap-1 text-[14px] text-brand-ink">
            {serien.map((s) => (
              <li key={s.id}>
                {s.wiederholend ? `jeden ${WOCHENTAGE[(s.wochentag ?? 1) - 1]}` : new Date(`${s.datum}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" })}, {s.von}–{s.bis} Uhr
                {s.halle ? ` · ${s.halle}` : ""}
              </li>
            ))}
          </ul>
        )}
        {darfTraining ? (
          <Link
            href={`/dashboard/training/neu?gruppe=${id}`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white hover:bg-brand-navy"
          >
            <Plus size={16} /> Training anlegen
          </Link>
        ) : darfVerwalten ? (
          <p className="mt-3 text-[13px] text-brand-ink-soft">Trainingszeiten legen der Vereinsadmin und die Trainer dieser Gruppe an.</p>
        ) : null}
      </section>
    </div>
  );
}
