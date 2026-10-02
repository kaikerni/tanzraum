import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Clock, ExternalLink, Mail, MapPin, Tag, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { OrtKarte } from "@/components/workshops/OrtKarte";
import { WorkshopAktionen } from "@/components/workshops/WorkshopAktionen";
import { googleMapsBrowserSchluessel } from "@/lib/geo/geocode";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";
import { KATEGORIE_LABEL, STATUS_LABEL, WORKSHOP_SPALTEN, datumText, istVergangen, kontaktLink, uhrzeitText, type Workshop } from "@/lib/workshops/workshops";

export const metadata = { title: "Workshop – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Zeile({ icon: Icon, children }: { icon: typeof Calendar; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-[14px] text-brand-ink">
      <Icon size={17} className="mt-0.5 shrink-0 text-brand-red" />
      <div className="min-w-0 [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

export default async function WorkshopDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gespeichert?: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/workshops/${id}`);
  // RLS: freigegeben fuer alle Angemeldeten, sonst nur Einreichende und berechtigtes Team
  const { data } = await supabase.from("workshops").select(WORKSHOP_SPALTEN).eq("id", id).maybeSingle();
  if (!data) notFound();
  const w = data as Workshop;
  const [rechte, sp, { data: bild }] = await Promise.all([
    meineTeamRechte(supabase),
    searchParams,
    w.bild_pfad ? supabase.storage.from("workshops").createSignedUrl(w.bild_pfad, 3600) : Promise.resolve({ data: null }),
  ]);
  const eigen = w.eingereicht_von === user.id;
  const vorFreigabe = ["entwurf", "eingereicht", "abgelehnt"].includes(w.status);
  const vergangen = istVergangen(w);
  const link = w.kontakt ? kontaktLink(w.kontakt) : null;
  const aktionen = {
    bearbeiten: darfTeam(rechte, "workshops.bearbeiten") || (eigen && vorFreigabe),
    freigeben: darfTeam(rechte, "workshops.freigeben"),
    ablehnen: darfTeam(rechte, "workshops.ablehnen"),
    archivieren: darfTeam(rechte, "workshops.archivieren"),
    loeschen: darfTeam(rechte, "workshops.loeschen") || (eigen && vorFreigabe),
    zurueckziehen: eigen,
  };
  const zeigeAktionen = Object.values(aktionen).some(Boolean) && (eigen || darfTeam(rechte, "workshops.ansehen") || aktionen.freigeben || aktionen.bearbeiten || aktionen.loeschen);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/workshops" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> Workshops
      </Link>

      {sp.gespeichert === "einreichen" && w.status === "eingereicht" && (
        <p className="form-success">Danke! Dein Workshop wurde eingereicht. Er wird vom TanzRaum-Team geprüft und nach der Freigabe angezeigt.</p>
      )}
      {sp.gespeichert === "entwurf" && <p className="form-success">Als Entwurf gespeichert – noch nicht eingereicht.</p>}
      {w.status !== "freigegeben" && (
        <p className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold ${w.status === "abgelehnt" ? "bg-brand-red-wash text-brand-red" : "bg-brand-gold-wash text-brand-ink"}`}>
          Status: {STATUS_LABEL[w.status] ?? w.status}
          {w.status === "abgelehnt" && w.ablehnungsgrund ? ` – ${w.ablehnungsgrund}` : ""}
          {w.status !== "archiviert" && " · Noch nicht öffentlich sichtbar."}
        </p>
      )}

      <article className={`${KARTE} flex flex-col gap-4`}>
        {bild?.signedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bild.signedUrl} alt="" className="-mx-1 aspect-[16/9] w-[calc(100%+8px)] rounded-2xl object-cover" />
        )}
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
            {w.kategorie && <span className="rounded-full bg-brand-gold-wash px-2 py-0.5 text-brand-ink">{KATEGORIE_LABEL[w.kategorie]}</span>}
            {vergangen && <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">Vergangener Workshop</span>}
          </div>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-brand-ink [overflow-wrap:anywhere]">{w.titel}</h1>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Zeile icon={Calendar}>{datumText(w, true)}</Zeile>
          {uhrzeitText(w) && <Zeile icon={Clock}>{uhrzeitText(w)}</Zeile>}
          <Zeile icon={Building2}>{w.ausrichter}</Zeile>
          <Zeile icon={MapPin}>
            {w.ort}
            {w.adresse ? <span className="block text-[13px] text-brand-ink-soft">{w.adresse}</span> : null}
            <span className="block text-[13px] text-brand-ink-soft">{w.bundesland}</span>
          </Zeile>
          {w.ansprechpartner && <Zeile icon={User}>{w.ansprechpartner}</Zeile>}
          {w.kontakt && (
            <Zeile icon={Mail}>
              {link ? (
                <a href={link} className="font-semibold text-brand-red">
                  {w.kontakt}
                </a>
              ) : (
                w.kontakt
              )}
            </Zeile>
          )}
        </div>
        <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-brand-ink [overflow-wrap:anywhere]">{w.beschreibung}</p>
        {w.link && (
          <a href={w.link} target="_blank" rel="noopener noreferrer" className="btn-primary mt-0 inline-flex min-h-11 w-fit items-center gap-1.5">
            Zur Ausschreibung / Anmeldung <ExternalLink size={15} />
          </a>
        )}
      </article>

      <section className={`${KARTE} flex flex-col gap-2`}>
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-brand-ink">
          <Tag size={17} className="text-brand-red" /> Wo findet der Workshop statt?
        </h2>
        <p className="text-[13.5px] text-brand-ink-soft">
          {w.adresse ? `${w.adresse}, ` : ""}
          {w.ort} · {w.bundesland}
        </p>
        <OrtKarte lat={w.lat} lng={w.lng} titel={w.titel} suche={`${w.adresse ? `${w.adresse}, ` : ""}${w.ort}, ${w.bundesland}`} schluessel={googleMapsBrowserSchluessel()} />
      </section>

      {zeigeAktionen && (
        <section className={KARTE}>
          <h2 className="mb-2 text-[15px] font-bold text-brand-ink">{eigen && !rechte.admin && !rechte.team ? "Deine Einreichung" : "Verwalten"}</h2>
          <WorkshopAktionen id={w.id} status={w.status} rechte={aktionen} />
        </section>
      )}
    </div>
  );
}
