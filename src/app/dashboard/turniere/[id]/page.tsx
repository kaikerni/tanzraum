import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Building, ExternalLink, Clock, Trophy, Users, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { heuteBerlin } from "@/lib/training/getTraining";
import {
  datumLang,
  getMeineStarts,
  getPlanungsVereine,
  getStammdaten,
  getStartTeilnehmer,
  getTurnier,
  getVereinsStarts,
  tageBis,
} from "@/lib/turniere/getTurniere";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { MerkenKnopf } from "@/components/turniere/MerkenKnopf";
import { MeineStarts } from "@/components/turniere/MeineStarts";
import { StartKarte } from "@/components/turniere/StartKarte";
import { NeuerStart, VereinsturnierLoeschen } from "@/components/turniere/NeuerStart";
import { VereinsturnierFormular } from "@/components/turniere/VereinsturnierFormular";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TurnierSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/turniere/${id}`);

  const turnier = await getTurnier(supabase, id);
  if (!turnier) notFound();

  const heute = heuteBerlin();
  const vorbei = turnier.letzterTag < heute;
  const [meine, planung, stammdaten, { data: istPlattformAdmin }] = await Promise.all([
    getMeineStarts(supabase, turnier.ersterTag),
    getPlanungsVereine(supabase),
    getStammdaten(supabase),
    supabase.rpc("ist_plattform_admin_aktuell"),
  ]);
  const meineHier = meine.filter((s) => s.turnierId === turnier.id);
  // Vereinsturniere nur fuer den eigenen Verein planbar
  const planbar = planung.filter((v) => !turnier.vereinId || v.vereinId === turnier.vereinId);
  const vereinsPlanung = await Promise.all(
    planbar.map(async (v) => {
      const starts = await getVereinsStarts(supabase, v.vereinId, turnier.ersterTag, turnier.letzterTag, turnier.id);
      const teilnehmer = await Promise.all(starts.map((s) => getStartTeilnehmer(supabase, s.id)));
      return { verein: v, starts, teilnehmer };
    }),
  );
  // Vereinsturnier: der eigene Verein; Katalogturnier (z. B. Beginn aus der Ausschreibung): Plattform-Administration
  const eigenesBearbeitbar = !!turnier.vereinId && planung.some((v) => v.vereinId === turnier.vereinId);
  const bearbeitbar = eigenesBearbeitbar || istPlattformAdmin === true;
  const ohneBeginn = !vorbei && turnier.tage.every((t) => !t.beginn) && !turnier.beginnSamstag && !turnier.beginnSonntag;
  const frist = turnier.meldeschluss ? tageBis(turnier.meldeschluss, heute) : null;
  const karte = `https://www.openstreetmap.org/search?query=${encodeURIComponent(turnier.adresse ?? turnier.ort)}`;

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/turniere" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Alle Turniere
      </Link>

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {turnier.vereinId && <span className="status-badge offen">Vereinsturnier · {turnier.vereinName}</span>}
            {[turnier.kategorie, turnier.typ !== turnier.kategorie && turnier.typ !== "Vereinsturnier" ? turnier.typ : null, turnier.verband]
              .filter(Boolean)
              .map((b) => (
                <span key={b} className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-ink-soft">
                  {b}
                </span>
              ))}
            {vorbei && <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-ink-soft">Vergangen</span>}
          </div>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-brand-ink">{turnier.name}</h1>
        </div>
        <MerkenKnopf turnierId={turnier.id} gemerkt={turnier.gemerkt} mitText />
      </div>

      <section className={`${KARTE} grid grid-cols-1 gap-4 sm:grid-cols-2`}>
        <div className="flex gap-2.5">
          <CalendarDays size={18} className="mt-0.5 shrink-0 text-brand-ink" />
          <div className="text-[13.5px] text-brand-ink">
            {turnier.tage.map((t) => {
              const beginn = t.beginn ?? (t.wochentag === "Samstag" ? turnier.beginnSamstag : t.wochentag === "Sonntag" ? turnier.beginnSonntag : null);
              return (
                <p key={t.datum}>
                  {datumLang(t.datum)}
                  {beginn ? <span className="text-brand-ink-soft"> · Beginn {beginn} Uhr</span> : null}
                </p>
              );
            })}
            {ohneBeginn && <p className="text-[12.5px] text-brand-ink-faint">Beginn laut Ausschreibung folgt.</p>}
          </div>
        </div>
        <div className="flex gap-2.5">
          <MapPin size={18} className="mt-0.5 shrink-0 text-brand-ink" />
          <div className="text-[13.5px] text-brand-ink">
            <p className="font-semibold">{turnier.ort}</p>
            {turnier.adresse && <p className="text-brand-ink-soft">{turnier.adresse}</p>}
            <a href={karte} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-brand-red">
              Auf der Karte zeigen
            </a>
          </div>
        </div>
        {turnier.ausrichter && (
          <div className="flex gap-2.5">
            <Building size={18} className="mt-0.5 shrink-0 text-brand-ink" />
            <p className="text-[13.5px] text-brand-ink">
              <span className="text-brand-ink-soft">Ausrichter: </span>
              {turnier.ausrichter}
            </p>
          </div>
        )}
        {turnier.meldeschluss && (
          <div className="flex gap-2.5">
            <Clock size={18} className={`mt-0.5 shrink-0 ${frist !== null && frist >= 0 && frist <= 14 ? "text-brand-red" : "text-brand-ink"}`} />
            <p className="text-[13.5px] text-brand-ink">
              <span className="text-brand-ink-soft">Meldeschluss: </span>
              {datumLang(turnier.meldeschluss)}
              {frist !== null && frist >= 0 && <span className="text-brand-ink-soft"> ({frist === 0 ? "heute" : `in ${frist} Tagen`})</span>}
            </p>
          </div>
        )}
        {turnier.ausschreibungUrl && (
          <a
            href={turnier.ausschreibungUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-brand-line px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            <ExternalLink size={15} /> Ausschreibung öffnen
          </a>
        )}
      </section>

      {meineHier.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={Trophy} titel="Deine Starts bei diesem Turnier" untertitel={vorbei ? undefined : "Sag deinem Verein Bescheid, ob du dabei bist."} />
          <MeineStarts starts={meineHier} heute={heute} mitTurnierLink={false} />
        </section>
      )}

      {vereinsPlanung.map(({ verein, starts, teilnehmer }) => (
        <section key={verein.vereinId} className={`${KARTE} flex flex-col gap-3`}>
          <KarteKopf
            icon={Users}
            titel={planbar.length > 1 ? `Starts von ${verein.vereinName}` : "Unsere Starts"}
            untertitel="Planung für deinen Verein. Die offizielle Meldung erfolgt beim Verband bzw. Ausrichter – danach hier auf „Gemeldet“ setzen."
          />
          {starts.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {starts.map((s, i) => (
                <StartKarte key={s.id} start={s} teilnehmer={teilnehmer[i]} verein={verein} tage={turnier.tage} stammdaten={stammdaten} vorbei={vorbei} />
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-brand-ink-soft">Noch keine Starts geplant.</p>
          )}
          {!vorbei && <NeuerStart verein={verein} turnierId={turnier.id} tage={turnier.tage} stammdaten={stammdaten} />}
        </section>
      ))}

      {bearbeitbar && (
        <section className={`${KARTE} flex flex-col gap-3`}>
          <details>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-brand-ink">
              <Pencil size={17} /> {turnier.vereinId ? "Vereinsturnier bearbeiten" : "Turnierdaten bearbeiten (Beginn, Ausschreibung, Meldeschluss …)"}
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <VereinsturnierFormular vereine={[]} turnier={turnier} />
              {eigenesBearbeitbar && <VereinsturnierLoeschen turnierId={turnier.id} />}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
