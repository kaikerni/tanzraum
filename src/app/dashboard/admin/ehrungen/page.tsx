import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Landmark, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { PruefBadge } from "@/components/ehrungen/Badges";
import { OrganisationFormular, PruefungFormular, VerbandAuszeichnungFormular } from "@/components/ehrungen/KatalogFormulare";
import type { Pruefstatus } from "@/lib/ehrungen/typen";

export const metadata = { title: "Ehrungskatalog – TanzRaum-Administration" };

const ART: Record<string, string> = { dachverband: "Dachverband", regionalverband: "Regionalverbände", traditionsverband: "Traditionsverbände", sonstige: "Sonstige" };

export default async function EhrungsKatalog() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const [{ data: orgs }, { data: arten }] = await Promise.all([
    supabase.from("ehrungs_organisationen").select("*").order("name"),
    supabase.from("ehrungsarten").select("id, organisation_id, name, stufe_nr, pruefstatus, aktiv, ehrungs_regeln(id)").eq("typ", "verband").order("stufe_nr", { nullsFirst: false }),
  ]);
  const offen = (arten ?? []).filter((a) => a.pruefstatus === "nicht_geprueft").length + (orgs ?? []).filter((o) => o.pruefstatus === "nicht_geprueft").length;

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> TanzRaum-Administration
      </Link>
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">🏛️ Ehrungskatalog</h1>
      <p className="rounded-xl bg-brand-amber-wash px-3.5 py-3 text-[13px] text-brand-ink">
        {orgs?.length ?? 0} Organisationen · {arten?.length ?? 0} Verbandsauszeichnungen · <strong>{offen}</strong> Einträge noch 🟡 nicht überprüft. Die
        Erstbefüllung stammt aus dem Ehrungs-Kompendium (Arbeitsgrundlage) – bitte anhand offizieller Verbandsunterlagen prüfen und Quelle/Link hinterlegen.
      </p>

      {Object.entries(ART).map(([art, titel]) => {
        const liste = (orgs ?? []).filter((o) => o.art === art);
        if (!liste.length) return null;
        return (
          <section key={art} className={KARTE}>
            <KarteKopf icon={Landmark} titel={titel} untertitel={`${liste.length} Organisation${liste.length === 1 ? "" : "en"}`} />
            <div className="flex flex-col gap-2">
              {liste.map((o) => {
                const eigene = (arten ?? []).filter((a) => a.organisation_id === o.id);
                return (
                  <details key={o.id} className="rounded-xl border border-brand-line">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2.5 text-[14px]">
                      <span className="font-semibold text-brand-ink">
                        {o.name}
                        {o.kuerzel ? ` (${o.kuerzel})` : ""}
                      </span>
                      <PruefBadge status={o.pruefstatus as Pruefstatus} />
                      <span className="text-[12.5px] text-brand-ink-soft">{eigene.length} Auszeichnung{eigene.length === 1 ? "" : "en"}</span>
                      {!o.aktiv && <span className="text-[12px] text-brand-red">inaktiv</span>}
                    </summary>
                    <div className="flex flex-col gap-4 border-t border-brand-line p-3">
                      {o.beschreibung && <p className="text-[13px] text-brand-ink-soft">{o.beschreibung}</p>}
                      {o.pruef_bemerkung && <p className="rounded-lg bg-brand-amber-wash px-3 py-2 text-[12.5px] text-brand-ink">⚠️ {o.pruef_bemerkung}</p>}
                      <ul className="flex flex-col gap-1.5">
                        {eigene.map((a) => (
                          <li key={a.id}>
                            <Link href={`/dashboard/admin/ehrungen/${a.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-line px-3 py-2 text-[13.5px] hover:bg-brand-bg">
                              <span className={`font-medium ${a.aktiv ? "text-brand-ink" : "text-brand-ink-faint line-through"}`}>{a.name}</span>
                              <PruefBadge status={a.pruefstatus as Pruefstatus} />
                              <span className="text-[12px] text-brand-ink-soft">{(a.ehrungs_regeln ?? []).length ? `${a.ehrungs_regeln.length} Regel(n)` : "Kriterien nicht hinterlegt"}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <details className="rounded-lg bg-brand-bg p-3">
                        <summary className="cursor-pointer text-[13px] font-semibold text-brand-ink">
                          <Plus size={14} className="-mt-0.5 inline" /> Auszeichnung hinzufügen
                        </summary>
                        <div className="pt-3">
                          <VerbandAuszeichnungFormular organisationId={o.id} />
                        </div>
                      </details>
                      <details className="rounded-lg bg-brand-bg p-3">
                        <summary className="cursor-pointer text-[13px] font-semibold text-brand-ink">Prüfung der Organisation</summary>
                        <div className="pt-3">
                          <PruefungFormular
                            tabelle="organisation"
                            daten={{
                              id: o.id,
                              pruefstatus: o.pruefstatus,
                              gepruefAm: o.geprueft_am,
                              quelle: o.quelle,
                              quelleUrl: o.quelle_url,
                              pruefBemerkung: o.pruef_bemerkung,
                              naechstePruefung: o.naechste_pruefung,
                              aktiv: o.aktiv,
                            }}
                          />
                        </div>
                      </details>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className={KARTE}>
        <KarteKopf icon={Plus} titel="Organisation hinzufügen" />
        <OrganisationFormular />
      </section>
    </div>
  );
}
