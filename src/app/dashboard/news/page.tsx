import { redirect } from "next/navigation";
import { Newspaper, PenSquare, BarChart3, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { getAnkuendigungen, getMeineNews, getMeineUmfragen, getVerfasserVereine, zieleText } from "@/lib/news/getNews";
import { NewsEintrag, NewsAlsGelesen } from "@/components/news/NewsEintrag";
import { UmfrageKarte } from "@/components/news/UmfrageKarte";
import { NewsFormular } from "@/components/news/NewsFormular";
import { UmfrageFormular } from "@/components/news/UmfrageFormular";
import { NewsRollenEinstellung } from "@/components/news/NewsRollenEinstellung";
import { AnkuendigungenLeiste } from "@/components/news/AnkuendigungenLeiste";

export const metadata = { title: "News & Umfragen – TanzRaum" };

export default async function NewsSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/news");

  const [news, umfragen, ankuendigungen, verfasser] = await Promise.all([
    getMeineNews(supabase),
    getMeineUmfragen(supabase),
    getAnkuendigungen(supabase),
    getVerfasserVereine(supabase, user.id),
  ]);
  const vereinIds = [...new Set([...news.map((n) => n.vereinId), ...verfasser.map((v) => v.vereinId)])];
  const { data: gruppen } = vereinIds.length ? await supabase.from("gruppen").select("id, name").in("verein_id", vereinIds) : { data: [] };
  const gruppenNamen = new Map(((gruppen ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name]));
  const ungeleseneNormale = news.filter((n) => n.istEmpfaenger && !n.gelesenAm && !n.wichtig).map((n) => n.id);
  const adminVereine = verfasser.filter((v) => v.istAdmin);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">News & Umfragen</h1>
        <p className="text-[14px] text-brand-ink-soft">Offizielle Informationen und Abstimmungen aus deinem Verein – und Ankündigungen von TanzRaum.</p>
      </div>

      <AnkuendigungenLeiste liste={ankuendigungen} ausblendbar={false} />
      <NewsAlsGelesen ids={ungeleseneNormale} />

      {verfasser.length > 0 && (
        <details className={`${KARTE} group`}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-brand-ink">
            <PenSquare size={18} className="text-brand-red" /> News schreiben
          </summary>
          <div className="mt-4">
            <NewsFormular vereine={verfasser} />
          </div>
        </details>
      )}
      {verfasser.length > 0 && (
        <details className={KARTE}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-brand-ink">
            <BarChart3 size={18} className="text-brand-blue" /> Umfrage starten
          </summary>
          <div className="mt-4">
            <UmfrageFormular vereine={verfasser} />
          </div>
        </details>
      )}
      {adminVereine.length > 0 && (
        <details className={KARTE}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-brand-ink">
            <Settings2 size={18} className="text-brand-ink-soft" /> Wer darf News und Umfragen erstellen?
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            {adminVereine.map((v) => (
              <NewsRollenEinstellung key={v.vereinId} vereinId={v.vereinId} vereinName={v.vereinName} rollen={v.newsRollen} />
            ))}
          </div>
        </details>
      )}

      {umfragen.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-bold text-brand-ink">Umfragen</h2>
          {umfragen.map((u) => (
            <UmfrageKarte key={u.id} u={u} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <KarteKopf icon={Newspaper} titel="News" />
        {news.length === 0 ? (
          <p className={`${KARTE} text-[13.5px] text-brand-ink-soft`}>Noch keine News. Hier erscheinen Informationen deines Vereins (mit Vereinslizenz).</p>
        ) : (
          news.map((n) => <NewsEintrag key={n.id} n={n} zielText={zieleText(n.ziele, gruppenNamen)} />)
        )}
      </section>
    </div>
  );
}
