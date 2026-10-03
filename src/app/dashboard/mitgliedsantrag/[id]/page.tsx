import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, FileDown, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { datumKurz, getAntragFormular } from "@/lib/antraege/getAntraege";
import { VERFAHREN_LABEL } from "@/lib/antraege/vorlage";
import { KARTE } from "@/components/dashboard/Karten";
import { AntragFormular } from "@/components/antraege/AntragFormular";
import { DruckKnopf, PapierHochladen } from "@/components/antraege/VereinsAktionen";

export const metadata = { title: "Mitgliedsantrag – TanzRaum" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Antragsteller bzw. verknuepftes Elternteil: Antrag ausfuellen oder Stand ansehen
export default async function MeinAntragSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/mitgliedsantrag/${id}`);
  const a = await getAntragFormular(supabase, id);
  if (!a) notFound();
  if (!a.fuerMich) redirect(`/dashboard/mitgliedsantraege/${id}`);
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const fuerKind = a.userId !== user.id;

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zum Dashboard
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Mitgliedsantrag</h1>
        <p className="text-[14px] text-brand-ink-soft">
          {a.verein.name}
          {fuerKind && a.personName ? ` · für ${a.personName}` : ""} · Es geht um die Mitgliedschaft im Verein – unabhängig von deinem TanzRaum-Tarif.
        </p>
      </div>

      {a.status === "offen" ? (
        <AntragFormular
          antragId={a.id}
          modus="antrag"
          vereinName={a.verein.name}
          logoUrl={a.verein.logo_url}
          inhalt={a.inhalt}
          start={a.daten}
          erlaubteVerfahren={a.erlaubteVerfahren}
          heute={heute}
          bestehendErlaubt={a.bestehendErlaubt}
          externText={a.externText}
          externLink={a.externLink}
        />
      ) : (
        <section className={`${KARTE} flex flex-col gap-3`}>
          <div className="flex items-start gap-3">
            {a.status === "angenommen" ? (
              <CheckCircle2 size={28} className="shrink-0 text-brand-green" />
            ) : a.status === "abgelehnt" ? (
              <XCircle size={28} className="shrink-0 text-brand-red" />
            ) : (
              <Clock size={28} className="shrink-0 text-brand-gold" />
            )}
            <div>
              <p className="text-[17px] font-bold text-brand-ink">
                {a.status === "angenommen" ? "Aufgenommen – willkommen im Verein!" : a.status === "abgelehnt" ? "Der Antrag wurde nicht angenommen." : "Dein Antrag ist beim Verein eingegangen."}
              </p>
              <p className="text-[13.5px] text-brand-ink-soft">
                Eingereicht am {datumKurz(a.eingereichtAm)}
                {a.verfahren ? ` · ${VERFAHREN_LABEL[a.verfahren]}` : ""}
                {a.entschiedenAm ? ` · entschieden am ${datumKurz(a.entschiedenAm)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <DruckKnopf href={`/api/mitgliedsantrag/pdf?antrag=${a.id}`} text="Antrag als PDF / drucken" />
            {a.aufnahmePdf && (
              <a
                href={`/api/mitgliedsantrag/datei?antrag=${a.id}&art=aufnahme`}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
              >
                <FileDown size={16} /> Aufnahmedokument
              </a>
            )}
          </div>
          {a.status === "eingereicht" && a.verfahren === "papier" && !a.papierVorliegend && (
            <div className="flex flex-col gap-2 rounded-xl bg-brand-gold-wash p-3.5">
              <p className="text-[13.5px] text-brand-ink">
                Bitte drucke das PDF aus, unterschreibe es und gib es beim Verein ab – oder lade den unterschriebenen Antrag hier als Foto oder Scan hoch.
              </p>
              <PapierHochladen antragId={a.id} vereinId={a.vereinId} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
