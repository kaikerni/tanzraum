import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, History, Pencil, Workflow, Award, UserRound, Paperclip, FileText, Image as Bild } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff, mitVerein } from "@/components/ehrungen/EhrungenKopf";
import { HerkunftBadge, PruefBadge, StatusBadge, TypBadge } from "@/components/ehrungen/Badges";
import { KorrekturFormular, StatusWechsel, VorgangBearbeiten, VorgangLoeschen, ZuruecksetzenFormular } from "@/components/ehrungen/EhrungenFormulare";
import { DokumentLoeschen, DokumentUpload } from "@/components/ehrungen/EhrungenAblauf";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getAuszeichnungen, getDokumente, getHistorie, getVorgang, type HistorieEintrag } from "@/lib/ehrungen/daten";
import { HERKUNFT, HINWEIS_VORSCHLAG, STATUS, datum, grundlageZeilen, type Herkunft, type Status } from "@/lib/ehrungen/typen";

export const metadata = { title: "Ehrung – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AKTION: Record<string, string> = {
  automatisch_erkannt: "Automatisch erkannt",
  manuell_angelegt: "Manuell angelegt",
  status: "Status geändert",
  geaendert: "Geändert",
  bearbeitet: "Bearbeitet",
  dokument: "Dokument hinzugefügt",
  dokument_entfernt: "Dokument entfernt",
};
const FELD: Record<string, string> = {
  ehrungsart: "Auszeichnung",
  status: "Status",
  faellig_am: "Voraussichtlich",
  grundlage_text: "Grund",
  grund: "Grund",
  korrektur: "Korrektur",
  herkunft: "Herkunft",
  wunsch_datum: "Wunschdatum",
  anlass: "Anlass",
  veranstaltung: "Veranstaltung",
  bestellt_am: "Bestellt am",
  erhalten_am: "Erhalten am",
  eingeplant_am: "Eingeplant am",
  verliehen_am: "Verliehen am",
  verliehen_durch: "Verliehen durch",
  interne_notiz: "Interne Notiz",
  begruendung: "Bemerkung",
  bestellung_id: "Bestellung",
  dokument: "Dokument",
  art: "Art",
};

function wert(feld: string, w: unknown): string {
  if (w === null || w === undefined || w === "") return "–";
  if (feld === "status") return `${STATUS[w as Status]?.zeichen ?? ""} ${STATUS[w as Status]?.label ?? String(w)}`;
  if (feld === "herkunft") return HERKUNFT[w as Herkunft]?.label ?? String(w);
  if (feld === "korrektur") return `Beginn ${datum((w as { beginn?: string }).beginn)}`;
  if (/_am$|datum/.test(feld) && typeof w === "string") return datum(w);
  return String(w);
}

function HistorieZeile({ e }: { e: HistorieEintrag }) {
  const felder = Object.keys(e.neu ?? e.alt ?? {}).filter((k) => !["ehrungsart_id", "faellig_jahr", "bestellung_id"].includes(k));
  return (
    <li className="flex flex-col gap-1 border-l-2 border-brand-line pb-3 pl-3">
      <p className="text-[12.5px] text-brand-ink-soft">
        {new Date(e.am).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" })} · {e.von}
      </p>
      <p className="text-[13.5px] font-semibold text-brand-ink">{AKTION[e.aktion] ?? e.aktion}</p>
      {felder.length > 0 && (
        <ul className="text-[13px] text-brand-ink">
          {felder.map((f) => (
            <li key={f}>
              {FELD[f] ?? f}: {e.alt && f in e.alt ? <span className="text-brand-ink-soft line-through">{wert(f, e.alt[f])}</span> : null}
              {e.alt && f in e.alt && e.neu ? " → " : ""}
              {e.neu && <span className="font-medium">{wert(f, e.neu[f])}</span>}
            </li>
          ))}
        </ul>
      )}
      {e.begruendung && <p className="text-[13px] italic text-brand-ink-soft">Begründung: „{e.begruendung}“</p>}
    </li>
  );
}

export default async function EhrungDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, vereine, ohneLizenz } = await ehrungsKontext();
  // RLS liefert nur Vorgaenge aus Vereinen, in denen die Person Vereinsadmin ist
  const vorgang = await getVorgang(supabase, id);
  const verein = vorgang ? vereine.find((v) => v.vereinId === vorgang.vereinId) : null;
  if (!vorgang || !verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const [arten, historie, dokumente] = await Promise.all([
    getAuszeichnungen(supabase, verein.vereinId),
    getHistorie(supabase, id),
    getDokumente(supabase, id),
  ]);
  const alleArten = [...arten.verband, ...arten.verein];
  if (!alleArten.some((a) => a.id === vorgang.ehrungsartId)) {
    // aktuelle Auszeichnung auch dann auswaehlbar halten, wenn der Verband inzwischen abgewaehlt wurde
    alleArten.unshift({ id: vorgang.ehrungsartId, name: vorgang.auszeichnung, typ: vorgang.typ, organisation: vorgang.organisation, aktiv: true } as never);
  }
  const geaendert = vorgang.autoEhrungsartId && vorgang.herkunft === "manuell_geaendert";
  const snapshot = vorgang.snapshot as Record<string, string | null> | null;

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <EhrungenKopf verein={verein} vereine={[]} titel={vorgang.auszeichnung} />

      <section className={`${KARTE} flex flex-col gap-2`}>
        <p className="text-[15px] font-semibold text-brand-ink">
          <UserRound size={16} className="-mt-0.5 mr-1 inline" />
          {vorgang.vereinsMitgliedId ? (
            <Link href={mitVerein(`${EHRUNGEN_PFAD}/mitglied/${vorgang.vereinsMitgliedId}`, verein.vereinId)} className="hover:text-brand-red">
              {vorgang.personName}
            </Link>
          ) : (
            <>{vorgang.personName || "Ehemaliges Mitglied"}</>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={vorgang.status} />
          <TypBadge typ={vorgang.typ} />
          <HerkunftBadge herkunft={vorgang.herkunft} />
          <PruefBadge status={vorgang.pruefstatus} />
          {vorgang.organisation && <span className="text-[12.5px] text-brand-ink-soft">{vorgang.organisation}</span>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-brand-ink-soft">Voraussichtlich</dt>
            <dd className="font-medium">{datum(vorgang.faelligAm)}</dd>
          </div>
          <div>
            <dt className="text-brand-ink-soft">Wunschtermin</dt>
            <dd className="font-medium">{datum(vorgang.wunschDatum)}</dd>
          </div>
          <div>
            <dt className="text-brand-ink-soft">Bestellt / erhalten</dt>
            <dd className="font-medium">
              {datum(vorgang.bestelltAm)} / {datum(vorgang.erhaltenAm)}
            </dd>
          </div>
          <div>
            <dt className="text-brand-ink-soft">Verliehen</dt>
            <dd className="font-medium">{datum(vorgang.verliehenAm)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={KARTE}>
          <KarteKopf icon={Calculator} titel="Warum? – Berechnungsgrundlage" untertitel={vorgang.herkunft === "manuell_angelegt" ? "Manuell angelegt" : HINWEIS_VORSCHLAG} />
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13.5px] text-brand-ink">
            {vorgang.herkunft !== "manuell_angelegt" && grundlageZeilen(vorgang.grundlage).map((z, i) => <li key={i}>{z}</li>)}
            {vorgang.grundlageText && <li>Grund: {vorgang.grundlageText}</li>}
          </ul>
          {geaendert && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-brand-line bg-brand-bg p-3 text-[13px]">
              <p className="font-semibold text-brand-ink">Ursprünglicher automatischer Vorschlag</p>
              <p>
                {vorgang.autoAuszeichnung} · voraussichtlich {datum(vorgang.autoFaelligAm)}
              </p>
              <ul className="list-disc pl-5 text-brand-ink-soft">
                {grundlageZeilen(vorgang.autoGrundlage).map((z, i) => (
                  <li key={i}>{z}</li>
                ))}
              </ul>
              {vorgang.status !== "verliehen" && <ZuruecksetzenFormular vorgang={vorgang} />}
            </div>
          )}
          {vorgang.vereinsMitgliedId && vorgang.status !== "verliehen" && (vorgang.grundlage?.regeln?.length ?? 0) > 0 && (
            <div className="mt-4 border-t border-brand-line pt-4">
              <KorrekturFormular vorgang={vorgang} />
            </div>
          )}
        </section>

        <section className={KARTE}>
          <KarteKopf icon={Workflow} titel="Status" untertitel="Möglich → geprüft → vorgemerkt → bestellt → erhalten → eingeplant → verliehen" />
          <StatusWechsel vorgang={vorgang} />
          {snapshot && (
            <div className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green-wash p-3 text-[13px] text-brand-ink">
              <p className="mb-1 flex items-center gap-1.5 font-semibold">
                <Award size={15} /> Festgehaltener Stand bei der Verleihung
              </p>
              <p>
                {snapshot.auszeichnung}
                {snapshot.stufe ? ` (${snapshot.stufe})` : ""}
                {snapshot.organisation ? ` · ${snapshot.organisation}` : ""}
              </p>
              <p>
                Verliehen am {datum(snapshot.verliehen_am)}
                {snapshot.verliehen_durch ? ` durch ${snapshot.verliehen_durch}` : ""}
              </p>
              {snapshot.grund && <p>Grund: {snapshot.grund}</p>}
            </div>
          )}
        </section>
      </div>

      {vorgang.bestellungId && (
        <p className="text-[13px] text-brand-ink-soft">
          📦 Teil einer{" "}
          <Link href={mitVerein(`${EHRUNGEN_PFAD}/bestellung/${vorgang.bestellungId}`, verein.vereinId)} className="font-semibold text-brand-red">
            Bestellung
          </Link>
        </p>
      )}

      <section className={KARTE}>
        <KarteKopf icon={Paperclip} titel="Urkunde, Fotos und Dokumente" untertitel="Privat gespeichert – nur für Vereinsadmins sichtbar" />
        {dokumente.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1.5">
            {dokumente.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-brand-line px-3 py-2 text-[13.5px]">
                <a href={d.url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 font-medium text-brand-ink hover:text-brand-red">
                  {d.mimeType?.startsWith("image/") ? <Bild size={15} /> : <FileText size={15} />}
                  <span className="truncate">{d.name}</span>
                  <span className="shrink-0 text-[12px] text-brand-ink-soft">
                    {d.art === "urkunde" ? "Urkunde" : d.art === "foto" ? "Foto" : "Dokument"} · {Math.max(1, Math.round(d.groesse / 1024))} KB
                  </span>
                </a>
                <DokumentLoeschen dokumentId={d.id} />
              </li>
            ))}
          </ul>
        )}
        <DokumentUpload vereinId={verein.vereinId} vorgangId={vorgang.id} />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={Pencil} titel="Bearbeiten" untertitel="Änderungen betreffen nur diesen Vorgang – nicht den Auszeichnungskatalog und nicht die Mitgliedsstammdaten." />
        <VorgangBearbeiten vorgang={vorgang} arten={alleArten} />
      </section>

      <section className={KARTE}>
        <KarteKopf icon={History} titel="Änderungshistorie" />
        {historie.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Einträge.</p>
        ) : (
          <ul className="flex flex-col">
            {historie.map((e) => (
              <HistorieZeile key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>

      {vorgang.status !== "verliehen" && (
        <div className="flex justify-end">
          <VorgangLoeschen vorgangId={vorgang.id} zurueck={mitVerein(EHRUNGEN_PFAD, verein.vereinId)} />
        </div>
      )}
    </div>
  );
}
