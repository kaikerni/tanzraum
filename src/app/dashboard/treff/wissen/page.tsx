import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, MessageSquareText, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { TreffReiter } from "@/components/treff/TreffReiter";
import { kategorienListe } from "@/lib/treff/laden";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";
import type { WissenArtikel } from "@/lib/wissen";

export const metadata = { title: "Wissensbeiträge – TanzRaum Treff" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 📚 Wissensbeitraege: redaktionelle Inhaltsart im TanzRaum Treff (kein eigener Bereich; lesen mit Konto ab FREE)
export default async function WissenSeite({ searchParams }: { searchParams: Promise<{ q?: string; kategorie?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/treff/wissen");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const kategorie = sp.kategorie && UUID.test(sp.kategorie) ? sp.kategorie : "";
  const [kategorien, rechte] = await Promise.all([kategorienListe(supabase), meineTeamRechte(supabase)]);
  let abfrage = supabase
    .from("wissen_artikel")
    .select("id, titel, kategorie_id, einleitung, status, veroeffentlicht_am, geaendert_am, treff_thema_id")
    .order("veroeffentlicht_am", { ascending: false, nullsFirst: true })
    .limit(100);
  if (kategorie) abfrage = abfrage.eq("kategorie_id", kategorie);
  // Suche: Titel und Inhalt (Volltext, deutsch) bzw. Teilwort im Titel
  if (q) abfrage = abfrage.or(`suchtext.wfts(german).${q.replace(/[(),]/g, " ")},titel.ilike.*${q.replace(/[(),*%]/g, " ")}*`);
  const { data } = await abfrage;
  const liste = (data ?? []) as Pick<WissenArtikel, "id" | "titel" | "kategorie_id" | "einleitung" | "status" | "veroeffentlicht_am" | "geaendert_am" | "treff_thema_id">[];
  const kat = new Map(kategorien.map((k) => [k.id, k]));
  const redaktion = darfTeam(rechte, "wissen.erstellen");

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
            <MessageSquareText size={26} className="text-brand-red" /> TanzRaum Treff
          </h1>
          <p className="text-[14.5px] font-semibold text-brand-ink-soft">Fragen · Austauschen · Wissen teilen</p>
        </div>
        {redaktion && (
          <Link href="/dashboard/treff/wissen/neu" className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5">
            <Plus size={17} /> Wissensbeitrag
          </Link>
        )}
      </div>
      <TreffReiter aktiv="wissen" />
      <p className="flex items-center gap-2 text-[14px] text-brand-ink-soft">
        <BookOpen size={17} className="text-brand-purple" /> Wissensbeiträge: redaktionell aufbereitetes Wissen aus der Tanzsport-Community – teils verknüpft mit der passenden Diskussion.
      </p>
      <form action="/dashboard/treff/wissen" className="flex flex-wrap gap-2" role="search">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-brand-line bg-white px-3.5 focus-within:border-brand-red">
          <Search size={18} className="text-brand-ink-soft" />
          <input name="q" defaultValue={q} placeholder="Titel, Inhalt oder Stichwort" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" aria-label="Wissensbeiträge durchsuchen" />
        </label>
        <select name="kategorie" defaultValue={kategorie} className="min-h-12 rounded-2xl border border-brand-line bg-white px-3 text-[14px]" aria-label="Kategorie">
          <option value="">Alle Kategorien</option>
          {kategorien.map((k) => (
            <option key={k.id} value={k.id}>
              {k.emoji} {k.name}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-12 rounded-2xl bg-brand-ink px-4 text-[14px] font-semibold text-white">
          Suchen
        </button>
      </form>
      {liste.length === 0 ? (
        <div className={`${KARTE} flex flex-col gap-2 text-[14px] text-brand-ink-soft`}>
          <p>{q || kategorie ? "Keine Wissensbeiträge gefunden." : "Noch keine Wissensbeiträge – sie entstehen aus den besten Diskussionen im TanzRaum Treff."}</p>
          <Link href="/dashboard/treff" className="inline-flex items-center gap-1.5 font-semibold text-brand-red">
            <MessageSquareText size={15} /> Zum TanzRaum Treff
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {liste.map((a) => (
            <li key={a.id}>
              <Link href={`/dashboard/treff/wissen/${a.id}`} className="flex h-full flex-col gap-1.5 rounded-2xl border border-brand-line bg-white p-3.5 hover:border-brand-red">
                <span className="flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
                  {a.kategorie_id && kat.get(a.kategorie_id) && (
                    <span className="rounded-full bg-brand-purple-wash px-2 py-0.5 text-brand-purple">
                      {kat.get(a.kategorie_id)!.emoji} {kat.get(a.kategorie_id)!.name}
                    </span>
                  )}
                  {a.status !== "veroeffentlicht" && <span className="rounded-full bg-brand-gold-wash px-2 py-0.5 text-brand-ink">Entwurf</span>}
                  {a.treff_thema_id && <span className="rounded-full bg-brand-bg px-2 py-0.5 text-brand-ink-soft">aus dem Treff</span>}
                </span>
                <span className="text-[15.5px] font-bold leading-snug text-brand-ink">{a.titel}</span>
                {a.einleitung && <span className="line-clamp-2 text-[13px] text-brand-ink-soft">{a.einleitung}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
