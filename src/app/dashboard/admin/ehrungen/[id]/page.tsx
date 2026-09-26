import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ListChecks, Tag, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { PruefBadge, TypBadge } from "@/components/ehrungen/Badges";
import { FunktionsListe, RegelFormular, RegelLoeschen } from "@/components/ehrungen/EhrungenFormulare";
import { PruefungFormular, VerbandAuszeichnungFormular } from "@/components/ehrungen/KatalogFormulare";
import { getAuszeichnung, getFunktionsnamen } from "@/lib/ehrungen/daten";
import { regelKurz } from "@/lib/ehrungen/typen";

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
  const [{ data: bemerkung }, funktionen] = await Promise.all([
    supabase.from("ehrungsarten").select("pruef_bemerkung").eq("id", id).maybeSingle(),
    getFunktionsnamen(supabase, null),
  ]);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/admin/ehrungen" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Ehrungskatalog
      </Link>
      <FunktionsListe namen={funktionen} />
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
        <KarteKopf icon={ListChecks} titel="Regeln" untertitel="Voreinstellung für alle Vereine – jeder Verein kann sie für sich anpassen. Nur belegte Kriterien hinterlegen." />
        {art.regeln.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {art.regeln.map((r) => (
              <li key={r.id} className="rounded-xl border border-brand-line px-3 py-2 text-[13.5px]">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {regelKurz(r)}
                    {r.bemerkung ? <span className="text-brand-ink-soft"> · {r.bemerkung}</span> : null}
                  </span>
                  <RegelLoeschen regelId={r.id} />
                </div>
                <details className="pt-1">
                  <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-red">Bearbeiten</summary>
                  <div className="pt-2">
                    <RegelFormular artId={art.id} regel={r} />
                  </div>
                </details>
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
