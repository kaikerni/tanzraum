import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ListChecks, Tag, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { PruefBadge, TypBadge } from "@/components/ehrungen/Badges";
import { RegelFormular, RegelLoeschen } from "@/components/ehrungen/EhrungenFormulare";
import { PruefungFormular, VerbandAuszeichnungFormular } from "@/components/ehrungen/KatalogFormulare";
import { getAuszeichnung } from "@/lib/ehrungen/daten";
import { regelText } from "@/lib/ehrungen/typen";

export const metadata = { title: "Verbandsauszeichnung – TanzRaum-Administration" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function KatalogAuszeichnung({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const art = await getAuszeichnung(supabase, id);
  if (!art || art.typ !== "verband") notFound();
  const { data: bemerkung } = await supabase.from("ehrungsarten").select("pruef_bemerkung").eq("id", id).maybeSingle();

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/admin/ehrungen" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Ehrungskatalog
      </Link>
      <h1 className="text-[24px] font-extrabold tracking-tight text-brand-ink">{art.name}</h1>
      <div className="flex flex-wrap items-center gap-1.5">
        <TypBadge typ="verband" />
        <PruefBadge status={art.pruefstatus} />
        <span className="text-[13px] text-brand-ink-soft">{art.organisation}</span>
      </div>
      {bemerkung?.pruef_bemerkung && <p className="rounded-lg bg-brand-amber-wash px-3 py-2 text-[13px] text-brand-ink">⚠️ {bemerkung.pruef_bemerkung}</p>}

      <section className={KARTE}>
        <KarteKopf icon={ShieldCheck} titel="Prüfung" untertitel="Prüfstatus, Quelle und Link zur offiziellen Quelle" />
        <PruefungFormular
          tabelle="auszeichnung"
          daten={{
            id: art.id,
            pruefstatus: art.pruefstatus,
            gepruefAm: art.gepruefAm,
            quelle: art.quelle,
            quelleUrl: art.quelleUrl,
            pruefBemerkung: art.pruefBemerkung,
            naechstePruefung: art.naechstePruefung,
            aktiv: art.aktiv,
          }}
        />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={ListChecks} titel="Regeln" untertitel="Nur belegte Kriterien hinterlegen – nichts ergänzen, was nicht in der Quelle steht." />
        {art.regeln.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1.5">
            {art.regeln.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-brand-line px-3 py-2 text-[13.5px]">
                <span>
                  {r.berechnung === "manuell" ? "Manuelle Vergabe" : regelText({ ...r, punkte_min: r.punkteMin, punkte_gewichte: r.punkteGewichte })}
                  {r.bemerkung ? <span className="text-brand-ink-soft"> · {r.bemerkung}</span> : null}
                </span>
                <RegelLoeschen regelId={r.id} />
              </li>
            ))}
          </ul>
        )}
        <RegelFormular artId={art.id} />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={Tag} titel="Angaben" untertitel="Änderungen wirken nicht auf bereits verliehene Ehrungen." />
        <VerbandAuszeichnungFormular art={{ ...art, antragErforderlich: art.antragErforderlich }} />
      </section>
    </div>
  );
}
