import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { SchreibHinweis, ThemaKarte } from "@/components/treff/TreffBausteine";
import { kategorienListe, themenListe, treffStatus } from "@/lib/treff/laden";
import { darfThemaErstellen } from "@/lib/treff/treff";

export const metadata = { title: "TanzRaum Treff" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TreffKategorie({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ seite?: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/treff");
  const seite = Math.max(0, Number((await searchParams).seite ?? 0) || 0);
  const [status, kategorien, themen] = await Promise.all([treffStatus(supabase), kategorienListe(supabase), themenListe(supabase, { kategorie: id, ansicht: "kategorie", limit: 31, offset: seite * 30 })]);
  const k = kategorien.find((x) => x.id === id);
  if (!k) notFound();
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/treff" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> TanzRaum Treff
      </Link>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-extrabold tracking-tight text-brand-ink">
            {k.emoji} {k.name}
          </h1>
          {k.beschreibung && <p className="text-[14px] text-brand-ink-soft">{k.beschreibung}</p>}
        </div>
        {darfThemaErstellen(status) && (
          <Link href={`/dashboard/treff/neu?kategorie=${k.id}`} className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5">
            <Plus size={17} /> Neues Thema
          </Link>
        )}
      </div>
      {!status.schreiben && <SchreibHinweis unter16={status.unter_16} gesperrtBis={status.gesperrt_bis} />}
      {themen.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>In dieser Kategorie gibt es noch keine Themen.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {themen.slice(0, 30).map((t) => (
            <ThemaKarte key={t.id} t={t} />
          ))}
        </div>
      )}
      <div className="flex justify-between">
        {seite > 0 ? (
          <Link href={`/dashboard/treff/kategorie/${k.id}?seite=${seite - 1}`} className="text-[13.5px] font-semibold text-brand-red">
            ← Neuere
          </Link>
        ) : (
          <span />
        )}
        {themen.length > 30 && (
          <Link href={`/dashboard/treff/kategorie/${k.id}?seite=${seite + 1}`} className="text-[13.5px] font-semibold text-brand-red">
            Ältere →
          </Link>
        )}
      </div>
    </div>
  );
}
