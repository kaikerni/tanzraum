import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks, Tag, Plus } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff, mitVerein } from "@/components/ehrungen/EhrungenKopf";
import { PruefBadge, TypBadge } from "@/components/ehrungen/Badges";
import {
  AnpassungZuruecksetzen,
  AuszeichnungFormular,
  FunktionsListe,
  RegelAnpassung,
  RegelFormular,
  RegelLoeschen,
} from "@/components/ehrungen/EhrungenFormulare";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getAnpassungen, getAuszeichnung, getFunktionsnamen } from "@/lib/ehrungen/daten";
import { PRUEFSTATUS, datum, regelKurz, wirksameRegel, type Anpassung } from "@/lib/ehrungen/typen";

export const metadata = { title: "Auszeichnung – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AuszeichnungSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ verein?: string; serie?: string; stufe_nr?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(sp.verein);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;

  if (id === "neu") {
    return (
      <div className="mx-auto flex max-w-[800px] flex-col gap-4">
        <EhrungenKopf verein={verein} vereine={[]} titel="Eigene Auszeichnung erstellen" />
        <section className={KARTE}>
          <p className="mb-3 text-[13px] text-brand-ink-soft">
            Die Auszeichnung wird als <strong>🏠 vereinsintern</strong> gekennzeichnet und ist nur für die Admins Ihres Vereins sichtbar. Regeln für automatische
            Vorschläge fügen Sie nach dem Anlegen hinzu.
          </p>
          <AuszeichnungFormular
            vereinId={verein.vereinId}
            vorlage={sp.serie ? { serie: sp.serie, stufeNr: Number(sp.stufe_nr) || null } : undefined}
          />
        </section>
      </div>
    );
  }
  if (!UUID.test(id)) notFound();
  const art = await getAuszeichnung(supabase, id);
  if (!art || (art.typ === "verein" && art.vereinId !== verein.vereinId)) return <KeinZugriff ohneLizenz={false} />;
  const eigene = art.typ === "verein";
  const [anpassungen, funktionen] = await Promise.all([
    eigene ? Promise.resolve(new Map<string, Anpassung>()) : getAnpassungen(supabase, verein.vereinId, art.regeln.map((r) => r.id)),
    getFunktionsnamen(supabase, verein.vereinId),
  ]);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <EhrungenKopf verein={verein} vereine={[]} titel={art.name} />
      <div className="flex flex-wrap items-center gap-1.5">
        <TypBadge typ={art.typ} />
        <PruefBadge status={art.pruefstatus} />
        {art.organisation && <span className="text-[13px] text-brand-ink-soft">{art.organisation}</span>}
      </div>

      <FunktionsListe namen={funktionen} />
      <section className={KARTE}>
        <KarteKopf
          icon={ListChecks}
          titel="Regeln für automatische Vorschläge"
          untertitel={
            (art.regelVerknuepfung === "alle" ? "Alle Regeln müssen erfüllt sein" : "Eine Regel genügt") +
            (eigene ? "" : " · Voreinstellung aus dem TanzRaum-Katalog, für Ihren Verein anpassbar")
          }
        />
        {art.regeln.length === 0 ? (
          <p className="mb-3 text-[13.5px] text-brand-ink-soft">Keine Regel hinterlegt – die Auszeichnung kann manuell vergeben werden.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {art.regeln.map((r) => {
              const anpassung = anpassungen.get(r.id) ?? null;
              const wirksam = wirksameRegel(r, anpassung);
              return (
                <li key={r.id} className="rounded-xl border border-brand-line px-3 py-2 text-[13.5px] text-brand-ink">
                  <div className="flex items-center justify-between gap-2">
                    <span className={anpassung && !anpassung.aktiv ? "text-brand-ink-faint line-through" : ""}>
                      {regelKurz(wirksam)}
                      {wirksam.bemerkung ? <span className="text-brand-ink-soft"> · {wirksam.bemerkung}</span> : null}
                    </span>
                    {eigene && <RegelLoeschen regelId={r.id} />}
                  </div>
                  {anpassung && (
                    <p className="pt-1 text-[12.5px] text-brand-ink-soft">
                      {anpassung.aktiv ? "✏️ Für Ihren Verein angepasst" : "⏸️ Für Ihren Verein ausgeschaltet"} · Voreinstellung: {regelKurz(r)}
                    </p>
                  )}
                  <details className="pt-1">
                    <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-red">
                      {eigene ? "Bearbeiten" : "Für unseren Verein anpassen"}
                    </summary>
                    <div className="flex flex-col gap-2 pt-2">
                      {eigene ? (
                        <RegelFormular artId={art.id} regel={r} />
                      ) : (
                        <>
                          <RegelAnpassung vereinId={verein.vereinId} basis={r} anpassung={anpassung} />
                          {anpassung && <AnpassungZuruecksetzen vereinId={verein.vereinId} regelId={r.id} />}
                        </>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {eigene && <RegelFormular artId={art.id} />}
      </section>

      {eigene ? (
        <section className={KARTE}>
          <KarteKopf
            icon={Tag}
            titel="Auszeichnung bearbeiten"
            untertitel="Bereits verliehene Ehrungen bleiben unverändert (der Stand bei der Verleihung ist festgehalten)."
            rechts={
              art.serie ? (
                <Link
                  href={mitVerein(`${EHRUNGEN_PFAD}/auszeichnung/neu?serie=${encodeURIComponent(art.serie)}&stufe_nr=${(art.stufeNr ?? 0) + 1}`, verein.vereinId)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-brand-line px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-bg"
                >
                  <Plus size={15} /> Weitere Stufe
                </Link>
              ) : undefined
            }
          />
          <AuszeichnungFormular vereinId={verein.vereinId} art={art} />
        </section>
      ) : (
        <section className={KARTE}>
          <KarteKopf icon={Tag} titel="Angaben aus dem Verbandskatalog" untertitel="Nur TanzRaum kann den Verbandskatalog ändern." />
          <dl className="grid grid-cols-1 gap-2 text-[13.5px] sm:grid-cols-2">
            {[
              ["Serie / Stufe", [art.serie, art.stufe].filter(Boolean).join(" · ") || "nicht hinterlegt"],
              ["Kategorie", art.kategorie ?? "nicht hinterlegt"],
              ["Voraussetzungen", art.voraussetzungen ?? "nicht hinterlegt"],
              ["Beschreibung", art.beschreibung ?? "nicht hinterlegt"],
              ["Prüfstatus", `${PRUEFSTATUS[art.pruefstatus].zeichen} ${PRUEFSTATUS[art.pruefstatus].text}`],
              ["Geprüft am", art.gepruefAm ? datum(art.gepruefAm) : "–"],
              ["Quelle", art.quelle ?? "nicht hinterlegt"],
              ["Nächste Überprüfung", art.naechstePruefung ? datum(art.naechstePruefung) : "–"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-brand-ink-soft">{k}</dt>
                <dd className="whitespace-pre-line font-medium text-brand-ink">{v}</dd>
              </div>
            ))}
            {art.quelleUrl && (
              <div>
                <dt className="text-brand-ink-soft">Offizielle Quelle</dt>
                <dd>
                  <a href={art.quelleUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-red">
                    Link öffnen
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
