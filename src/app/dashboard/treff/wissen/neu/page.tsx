import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { WissenEditor } from "@/components/wissen/WissenEditor";
import { kategorienListe } from "@/lib/treff/laden";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";
import type { ThemaDetail } from "@/lib/treff/treff";

export const metadata = { title: "Wissensbeitrag erstellen – TanzRaum" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Treff -> Wissen: aus einem Thema einen Wissensbeitrag vorbereiten (das Thema bleibt erhalten)
export default async function WissenNeu({ searchParams }: { searchParams: Promise<{ thema?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const rechte = await meineTeamRechte(supabase);
  if (!darfTeam(rechte, "wissen.erstellen")) redirect("/dashboard/treff/wissen");
  const themaId = (await searchParams).thema;
  let vorlage = null;
  if (themaId && UUID.test(themaId)) {
    const { data } = await supabase.rpc("treff_thema", { p_id: themaId });
    const t = data as ThemaDetail | null;
    if (t) {
      const beste = t.beitraege.find((b) => b.id === t.beste_antwort_id);
      const empfohlen = t.beitraege.filter((b) => b.empfohlen && b.id !== t.beste_antwort_id);
      vorlage = {
        themaId: t.id,
        titel: t.titel,
        kategorieId: t.kategorie_id,
        inhalt: [`Frage aus dem Treff:\n${t.inhalt}`, beste ? `\nBeste Antwort:\n${beste.inhalt}` : "", ...empfohlen.map((b) => `\nEmpfohlen:\n${b.inhalt}`)].join("\n").slice(0, 30000),
      };
    }
  }
  const kategorien = await kategorienListe(supabase);
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4">
      <Link href={vorlage ? `/dashboard/treff/thema/${vorlage.themaId}` : "/dashboard/treff/wissen"} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> Zurück
      </Link>
      <h1 className="flex items-center gap-2 text-[24px] font-extrabold tracking-tight text-brand-ink">
        <BookOpen size={24} className="text-brand-purple" /> Wissensbeitrag erstellen
      </h1>
      {vorlage && <p className="text-[13.5px] text-brand-ink-soft">Vorbefüllt aus der Treff-Diskussion – bitte redaktionell überarbeiten (keine persönlichen Angaben übernehmen).</p>}
      <section className={KARTE}>
        <WissenEditor userId={user.id} kategorien={kategorien} vorlage={vorlage} />
      </section>
    </div>
  );
}
