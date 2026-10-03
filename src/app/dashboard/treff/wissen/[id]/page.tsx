import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, MessageSquareText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { WissenAktionen } from "@/components/wissen/WissenAktionen";
import { kategorienListe } from "@/lib/treff/laden";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";
import { WISSEN_SPALTEN, type WissenArtikel } from "@/lib/wissen";

export const metadata = { title: "Wissensbeitrag – TanzRaum Treff" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WissenArtikelSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?weiter=/dashboard/treff/wissen/${id}`);
  const { data } = await supabase.from("wissen_artikel").select(WISSEN_SPALTEN).eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as WissenArtikel;
  const [kategorien, rechte, { data: bild }] = await Promise.all([
    kategorienListe(supabase),
    meineTeamRechte(supabase),
    a.bild_pfad ? supabase.storage.from("wissen").createSignedUrl(a.bild_pfad, 3600) : Promise.resolve({ data: null }),
  ]);
  const k = kategorien.find((x) => x.id === a.kategorie_id);
  const r = { bearbeiten: darfTeam(rechte, "wissen.bearbeiten"), veroeffentlichen: darfTeam(rechte, "wissen.veroeffentlichen"), loeschen: darfTeam(rechte, "wissen.loeschen") };
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4">
      <Link href="/dashboard/treff/wissen" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> Wissensbeiträge im TanzRaum Treff
      </Link>
      {a.status !== "veroeffentlicht" && <p className="rounded-2xl bg-brand-gold-wash px-4 py-3 text-[13.5px] font-semibold text-brand-ink">Entwurf – nur für die Redaktion sichtbar.</p>}
      <article className={`${KARTE} flex flex-col gap-4`}>
        <span className="flex flex-wrap gap-1.5 text-[12px] font-semibold">
          <span className="rounded-full bg-brand-purple-wash px-2.5 py-0.5 text-brand-purple">📚 Wissensbeitrag</span>
          {k && (
            <span className="rounded-full bg-brand-bg px-2.5 py-0.5 text-brand-ink-soft">
              {k.emoji} {k.name}
            </span>
          )}
        </span>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-brand-ink [overflow-wrap:anywhere]">{a.titel}</h1>
        <p className="text-[12.5px] text-brand-ink-soft">
          {a.veroeffentlicht_am ? `Veröffentlicht am ${new Date(a.veroeffentlicht_am).toLocaleDateString("de-DE")}` : `Erstellt am ${new Date(a.erstellt_am).toLocaleDateString("de-DE")}`}
          {new Date(a.geaendert_am).getTime() - new Date(a.erstellt_am).getTime() > 60_000 ? ` · aktualisiert am ${new Date(a.geaendert_am).toLocaleDateString("de-DE")}` : ""}
        </p>
        {bild?.signedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bild.signedUrl} alt="" className="max-h-[420px] w-full rounded-2xl object-cover" />
        )}
        {a.einleitung && <p className="text-[16px] font-semibold leading-relaxed text-brand-ink">{a.einleitung}</p>}
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-brand-ink [overflow-wrap:anywhere]">{a.inhalt}</div>
        {a.link && (
          <a href={a.link} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-brand-red">
            Weiterführender Link <ExternalLink size={14} />
          </a>
        )}
        {a.redaktionshinweis && <p className="rounded-xl bg-brand-bg px-3 py-2 text-[12.5px] italic text-brand-ink-soft">{a.redaktionshinweis}</p>}
      </article>
      {a.treff_thema_id && (
        <section className={`${KARTE} flex flex-col gap-2 sm:flex-row sm:items-center`}>
          <p className="flex flex-1 items-center gap-2 text-[14px] font-semibold text-brand-ink">
            <MessageSquareText size={18} className="text-brand-red" /> Zu diesem Wissensbeitrag gibt es eine Diskussion im TanzRaum Treff.
          </p>
          <Link href={`/dashboard/treff/thema/${a.treff_thema_id}`} className="btn-primary mt-0 inline-flex min-h-10 items-center justify-center px-4 text-[14px]">
            💬 Zur Diskussion im TanzRaum Treff →
          </Link>
        </section>
      )}
      {(r.bearbeiten || r.veroeffentlichen || r.loeschen) && (
        <section className={KARTE}>
          <h2 className="mb-2 text-[15px] font-bold text-brand-ink">Redaktion</h2>
          <WissenAktionen id={a.id} status={a.status} rechte={r} />
        </section>
      )}
    </div>
  );
}
