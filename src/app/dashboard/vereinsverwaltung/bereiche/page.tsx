import Link from "next/link";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { KeinZugriff } from "@/components/ehrungen/EhrungenKopf";
import { BereicheFormular } from "@/components/verwaltung/BereicheFormular";

export const metadata = { title: "Bereiche – Vereinsverwaltung" };

// Vereinsadmin schaltet Bereiche ein/aus: Navigation, Dashboard-Karten und Seiten passen sich an. Keine Daten werden geloescht.
export default async function BereicheSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const { verein: gewaehlt } = await searchParams;
  const { supabase, verein, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const { data } = await supabase.from("vereine").select("module_aus").eq("id", verein.vereinId).maybeSingle();
  const aus = ((data?.module_aus ?? []) as string[]).filter(Boolean);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Link href={`/dashboard/vereinsverwaltung?verein=${verein.vereinId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Vereinsverwaltung
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Bereiche</h1>
        <p className="text-[14px] text-brand-ink-soft">
          {verein.vereinName} · Legt fest, welche Bereiche eure Mitglieder sehen. Ausgeschaltete Bereiche verschwinden aus Navigation, Dashboard und
          Benachrichtigungen – gespeicherte Daten bleiben erhalten und sind beim Wiedereinschalten wieder da.
        </p>
      </div>
      <section className={KARTE}>
        <KarteKopf icon={LayoutGrid} titel="Bereiche des Vereins" />
        <BereicheFormular vereinId={verein.vereinId} aus={aus} />
      </section>
    </div>
  );
}
