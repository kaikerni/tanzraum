import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Users, Pencil, Building2, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { heuteBerlin } from "@/lib/training/getTraining";
import { ART_LABEL, getTermin, getTeilnehmer, type Termin } from "@/lib/kalender/getKalender";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { RueckmeldeListe, TerminLoeschenKnopf } from "@/components/kalender/TerminAktionen";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const STATUS_TEXT = { zugesagt: "Zusage", vielleicht: "Vielleicht", abgesagt: "Absage" } as const;

function datumText(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function wannText(t: Termin) {
  const tage = t.bisDatum ? `${datumText(t.datum)} bis ${datumText(t.bisDatum)}` : datumText(t.datum);
  if (!t.von) return `${tage} · ganztägig`;
  return `${tage} · ${t.von}${t.bis ? `–${t.bis}` : ""} Uhr`;
}

function zielgruppeText(t: Termin) {
  if (t.zielgruppe === "gruppen") return `Gruppen: ${t.gruppen.join(", ")}`;
  if (t.zielgruppe === "leitung") return "Vorstand & Trainer";
  return "Ganzer Verein";
}

export default async function TerminSeite({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const termin = await getTermin(supabase, id);
  if (!termin) notFound();

  const vorbei = (termin.bisDatum ?? termin.datum) < heuteBerlin();
  const teilnehmer = termin.vereinId && termin.darfBearbeiten ? await getTeilnehmer(supabase, termin.id) : [];

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4">
      <Link
        href={`/dashboard/kalender?tag=${termin.datum}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink"
      >
        <ArrowLeft size={15} /> Zurück zum Kalender
      </Link>

      <section className={KARTE}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`status-badge ${termin.art === "privat" ? "offen" : "kann"}`}>{ART_LABEL[termin.art]}</span>
            <h1 className="mt-2 text-[24px] font-extrabold leading-tight tracking-tight text-brand-ink">{termin.titel}</h1>
          </div>
          {termin.darfBearbeiten && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/kalender/termin/${termin.id}/bearbeiten`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
              >
                <Pencil size={15} /> Bearbeiten
              </Link>
              <TerminLoeschenKnopf terminId={termin.id} />
            </div>
          )}
        </div>

        <dl className="mt-4 flex flex-col gap-2.5 text-[14px] text-brand-ink">
          <div className="flex items-start gap-2.5">
            <Clock size={17} className="mt-0.5 shrink-0 text-brand-ink-soft" />
            <dt className="sr-only">Wann</dt>
            <dd>{wannText(termin)}</dd>
          </div>
          {termin.ort && (
            <div className="flex items-start gap-2.5">
              <MapPin size={17} className="mt-0.5 shrink-0 text-brand-ink-soft" />
              <dt className="sr-only">Ort</dt>
              <dd>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(termin.ort)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-brand-line underline-offset-4 hover:text-brand-red"
                >
                  {termin.ort}
                </a>
              </dd>
            </div>
          )}
          {termin.vereinName && (
            <div className="flex items-start gap-2.5">
              <Building2 size={17} className="mt-0.5 shrink-0 text-brand-ink-soft" />
              <dt className="sr-only">Verein und Zielgruppe</dt>
              <dd>
                {termin.vereinName} · {zielgruppeText(termin)}
              </dd>
            </div>
          )}
        </dl>

        {termin.beschreibung && <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-brand-ink">{termin.beschreibung}</p>}
      </section>

      {termin.rueckmeldung && (
        <section className={KARTE}>
          <KarteKopf
            icon={CalendarDays}
            titel={vorbei ? "Rückmeldungen" : "Bist du dabei?"}
            untertitel={`${termin.zusagen} Zusagen · ${termin.vielleicht} vielleicht · ${termin.absagen} Absagen`}
          />
          {termin.personen.length > 0 ? (
            <RueckmeldeListe terminId={termin.id} personen={termin.personen} vorbei={vorbei} />
          ) : (
            <p className="text-[13px] text-brand-ink-soft">Du selbst bist zu diesem Termin nicht eingeladen.</p>
          )}
        </section>
      )}

      {teilnehmer.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={Users} titel="Eingeladene" untertitel={`${teilnehmer.length} Personen – nur für die Terminverwaltung sichtbar`} />
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {teilnehmer.map((p) => (
              <li key={p.vmId} className="flex items-center justify-between gap-3 border-b border-brand-line py-2 text-[13.5px] last:border-0">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-brand-ink">{p.name}</span>
                  {p.kommentar && <span className="block truncate text-[12px] text-brand-ink-soft">{p.kommentar}</span>}
                </span>
                {termin.rueckmeldung && (
                  <span className={`status-badge shrink-0 ${p.status ?? "offen"}`}>{p.status ? STATUS_TEXT[p.status] : "offen"}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
