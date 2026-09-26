import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ScrollText, Plus } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff, mitVerein } from "@/components/ehrungen/EhrungenKopf";
import { StatusBadge, TypBadge } from "@/components/ehrungen/Badges";
import { FunktionsListe, ZeitraumFormular, ZeitraumLoeschen } from "@/components/ehrungen/EhrungenFormulare";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getFunktionsnamen, getVorgaenge, getZeitraeume } from "@/lib/ehrungen/daten";
import { getMitgliederListe } from "@/lib/mitglieder/getMitglieder";
import { ZEITRAUM_ART, datum } from "@/lib/ehrungen/typen";

export const metadata = { title: "Mitglied – Ehrungen – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EhrungenMitglied({ params, searchParams }: { params: Promise<{ vmId: string }>; searchParams: Promise<{ verein?: string }> }) {
  const [{ vmId }, { verein: gewaehlt }] = await Promise.all([params, searchParams]);
  if (!UUID.test(vmId)) notFound();
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const [mitglieder, zeitraeume, vorgaenge, funktionen] = await Promise.all([
    getMitgliederListe(supabase, verein.vereinId),
    getZeitraeume(supabase, verein.vereinId, vmId),
    getVorgaenge(supabase, verein.vereinId),
    getFunktionsnamen(supabase, verein.vereinId),
  ]);
  const mitglied = (mitglieder ?? []).find((m) => m.vmId === vmId);
  if (!mitglied) return <KeinZugriff ohneLizenz={false} />;
  const eigene = vorgaenge.filter((v) => v.vereinsMitgliedId === vmId);
  const historie = eigene.filter((v) => v.status === "verliehen").sort((a, b) => (a.verliehenAm ?? "").localeCompare(b.verliehenAm ?? ""));
  const offen = eigene.filter((v) => v.status !== "verliehen");

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <EhrungenKopf verein={verein} vereine={[]} titel={mitglied.name} />
      <FunktionsListe namen={funktionen} />

      <section className={KARTE}>
        <KarteKopf icon={Clock} titel="Mitglieds- und Tätigkeitszeiten" untertitel="Stammdaten für die Berechnung. Mehrere Zeiträume (z. B. mit Pause) sind möglich." />
        {zeitraeume.length > 0 && (
          <ul className="mb-4 flex flex-col gap-3">
            {zeitraeume.map((z) => (
              <li key={z.id} className="flex items-start gap-2 rounded-xl border border-brand-line p-3">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-[13px] font-semibold text-brand-ink">
                    {ZEITRAUM_ART[z.art]}
                    {z.funktion ? `: ${z.funktion}` : ""} · {datum(z.von)} – {z.bis ? datum(z.bis) : "heute"}
                  </p>
                  <ZeitraumFormular vereinId={verein.vereinId} vmId={vmId} zeitraum={z} />
                </div>
                <ZeitraumLoeschen zeitraumId={z.id} />
              </li>
            ))}
          </ul>
        )}
        <p className="mb-2 text-[13px] font-semibold text-brand-ink">Zeitraum hinzufügen</p>
        <ZeitraumFormular vereinId={verein.vereinId} vmId={vmId} />
      </section>

      <section className={KARTE}>
        <KarteKopf
          icon={ScrollText}
          titel="Ehrungshistorie"
          untertitel="Verliehene Ehrungen – nur für Vereinsadmins sichtbar"
          rechts={
            <Link
              href={mitVerein(`${EHRUNGEN_PFAD}/neu?mitglied=${vmId}`, verein.vereinId)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-brand-line px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
            >
              <Plus size={15} /> Ehrung hinzufügen
            </Link>
          }
        />
        {historie.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine verliehenen Ehrungen erfasst.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {historie.map((v) => (
              <li key={v.id}>
                <Link href={`${EHRUNGEN_PFAD}/${v.id}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-line px-3 py-2.5 hover:bg-brand-bg">
                  <span className="w-12 text-[14px] font-extrabold text-brand-ink">{v.verliehenAm?.slice(0, 4)}</span>
                  <TypBadge typ={v.typ} />
                  <span className="text-[13.5px] font-medium text-brand-ink">{String(v.snapshot?.auszeichnung ?? v.auszeichnung)}</span>
                  {v.organisation && <span className="text-[12.5px] text-brand-ink-soft">{v.organisation}</span>}
                </Link>
              </li>
            ))}
          </ol>
        )}
        {offen.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[13px] font-semibold text-brand-ink">Offene Vorgänge</p>
            <ul className="flex flex-col gap-2">
              {offen.map((v) => (
                <li key={v.id}>
                  <Link href={`${EHRUNGEN_PFAD}/${v.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-line px-3 py-2.5 hover:bg-brand-bg">
                    <span className="text-[13.5px] text-brand-ink">
                      {v.auszeichnung} · {datum(v.faelligAm)}
                    </span>
                    <StatusBadge status={v.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
