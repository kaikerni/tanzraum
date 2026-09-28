import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileCheck2, Pencil, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { datumKurz, getAntragFormular } from "@/lib/antraege/getAntraege";
import { FELD_LABEL, ibanLesbar, minderjaehrig, UNTERSCHRIFT_LABEL, VERFAHREN_LABEL, type FeldSchluessel } from "@/lib/antraege/vorlage";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { StatusMarke } from "@/components/antraege/StatusMarke";
import { DruckKnopf, EntscheidungKnoepfe, PapierHochladen } from "@/components/antraege/VereinsAktionen";
import { VerwaltungsFelder } from "@/components/antraege/VerwaltungsFelder";

export const metadata = { title: "Mitgliedsantrag – TanzRaum" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Zeile({ label, wert }: { label: string; wert: string | null | undefined }) {
  if (!wert) return null;
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-brand-line py-1.5 text-[13.5px] last:border-0">
      <dt className="text-brand-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words text-brand-ink">{wert}</dd>
    </div>
  );
}

export default async function AntragDetailSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/mitgliedsantraege/${id}`);

  const a = await getAntragFormular(supabase, id);
  if (!a) notFound();
  if (!a.darfVerwalten) redirect(`/dashboard/mitgliedsantrag/${id}`);

  const d = a.daten;
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const minderj = minderjaehrig(d.geburtsdatum, heute);
  const name = [d.vorname, d.nachname].filter(Boolean).join(" ") || a.personName || "Unbekannt";
  const offenOderEingang = a.status === "offen" || a.status === "eingereicht";
  const unterschriftRollen = Object.entries(a.unterschriften).filter(([, u]) => u);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href={`/dashboard/mitgliedsantraege?verein=${a.vereinId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Alle Mitgliedsanträge
      </Link>

      <section className={KARTE}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <StatusMarke status={a.status} />
            <h1 className="mt-2 text-[24px] font-extrabold leading-tight tracking-tight text-brand-ink">{name}</h1>
            <p className="text-[13px] text-brand-ink-soft">
              {a.eingereichtAm ? `Eingegangen am ${datumKurz(a.eingereichtAm)}` : `Hinzugefügt am ${datumKurz(a.erstelltAm)} – Antrag noch nicht ausgefüllt`}
              {a.verfahren ? ` · ${VERFAHREN_LABEL[a.verfahren]}` : ""}
              {a.entschiedenAm ? ` · entschieden am ${datumKurz(a.entschiedenAm)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DruckKnopf href={`/api/mitgliedsantrag/pdf?antrag=${a.id}`} />
            {a.status !== "abgelehnt" && (
              <Link
                href={`/dashboard/mitgliedsantraege/${a.id}/bearbeiten`}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
              >
                <Pencil size={15} /> Bearbeiten
              </Link>
            )}
          </div>
        </div>
        {a.status === "abgelehnt" && a.ablehnungsgrund && <p className="mt-3 rounded-xl bg-brand-red-wash px-3 py-2 text-[13px] text-brand-red-deep">Grund (intern): {a.ablehnungsgrund}</p>}
        {offenOderEingang && (
          <div className="mt-4 border-t border-brand-line pt-4">
            {a.verfahren === "papier" && !a.papierVorliegend && (
              <p className="mb-3 rounded-xl bg-brand-gold-wash px-3 py-2 text-[13px] text-brand-ink">
                Die Unterschrift folgt auf Papier. Ihr könnt trotzdem schon entscheiden – oder erst, wenn der unterschriebene Antrag vorliegt.
              </p>
            )}
            <EntscheidungKnoepfe antragId={a.id} name={name} />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <section className={KARTE}>
          <KarteKopf icon={FileCheck2} titel="Angaben" />
          <dl>
            <Zeile label="Mitgliedsart" wert={[d.mitgliedsart, d.foerderbeitrag ? `Förderbeitrag ${d.foerderbeitrag}` : ""].filter(Boolean).join(" · ")} />
            <Zeile label="Gruppe/Abteilung" wert={[...d.abteilungen, d.abteilung_sonstige].filter(Boolean).join(", ")} />
            <Zeile label="Name" wert={`${d.nachname}, ${d.vorname}`} />
            <Zeile label="Anschrift" wert={[d.strasse, [d.plz, d.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
            <Zeile label="Geburtsdatum" wert={d.geburtsdatum ? `${datumKurz(d.geburtsdatum)}${minderj ? " (minderjährig)" : ""}` : ""} />
            <Zeile label="E-Mail" wert={d.email} />
            {(Object.keys(FELD_LABEL) as FeldSchluessel[]).map((k) => (
              <Zeile key={k} label={FELD_LABEL[k]} wert={d[k] as string} />
            ))}
            <Zeile label="Sorgeberechtigte" wert={d.sorgeberechtigte.map((s) => s.name).join(", ")} />
            {a.inhalt.sepa_aktiv && (
              <>
                <Zeile label="SEPA-Mandat" wert={d.sepa_erteilt ? "erteilt" : a.status === "offen" ? "" : "nicht erteilt"} />
                <Zeile label="Kontoinhaber" wert={d.sepa_kontoinhaber} />
                <Zeile label="Kreditinstitut" wert={d.sepa_bank} />
                <Zeile label="IBAN" wert={d.sepa_iban ? ibanLesbar(d.sepa_iban) : ""} />
                <Zeile label="BIC" wert={d.sepa_bic} />
              </>
            )}
            {a.inhalt.foto_aktiv && <Zeile label="Foto-Einwilligung" wert={d.foto === "ja" ? "Ja" : d.foto === "nein" ? "Nein" : ""} />}
            <Zeile label="Ort" wert={d.unterschrift_ort} />
          </dl>
        </section>

        <div className="flex flex-col gap-4">
          <section className={KARTE}>
            <KarteKopf icon={ShieldCheck} titel="Unterschriften" />
            {a.verfahren === "papier" ? (
              <p className="text-[13px] text-brand-ink-soft">{a.papierVorliegend ? "Unterschriebener Antrag liegt vor." : "Unterschrift auf Papier ausstehend."}</p>
            ) : unterschriftRollen.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {unterschriftRollen.map(([rolle, u]) => (
                  <li key={rolle} className="text-[12.5px] text-brand-ink">
                    <span className="font-semibold">{UNTERSCHRIFT_LABEL[rolle as keyof typeof UNTERSCHRIFT_LABEL]}</span>
                    {u?.bild && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.bild} alt="" className="mt-1 h-12 w-full rounded-lg border border-brand-line bg-white object-contain" />
                    )}
                    {u?.name && <span className="block italic">bestätigt: {u.name}</span>}
                    <span className="block text-brand-ink-soft">{u?.zeitpunkt ? new Date(u.zeitpunkt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : ""}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-brand-ink-soft">Noch keine.</p>
            )}
            {a.papierDatei && (
              <a href={`/api/mitgliedsantrag/datei?antrag=${a.id}&art=papier`} target="_blank" rel="noopener" className="mt-2 inline-flex text-[13px] font-semibold text-brand-red">
                Hochgeladenen Antrag öffnen →
              </a>
            )}
            {a.status !== "abgelehnt" && (
              <div className="mt-3">
                <PapierHochladen antragId={a.id} vereinId={a.vereinId} text={a.papierDatei ? "Andere Datei hochladen" : "Unterschriebenen Antrag hochladen"} />
              </div>
            )}
            {a.aufnahmePdf && (
              <a href={`/api/mitgliedsantrag/datei?antrag=${a.id}&art=aufnahme`} target="_blank" rel="noopener" className="mt-3 inline-flex text-[13px] font-semibold text-brand-red">
                Aufnahmedokument (PDF) →
              </a>
            )}
          </section>

          <section className={KARTE}>
            <KarteKopf icon={Pencil} titel="Vom Verein auszufüllen" />
            <VerwaltungsFelder
              antragId={a.id}
              mitgliedsnummer={a.mitgliedsnummer}
              familiennummer={a.familiennummer}
              notiz={a.notizIntern}
              papierVorliegend={a.papierVorliegend}
              papierVerfahren={a.verfahren === "papier"}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
