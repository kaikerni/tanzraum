import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Flame, Flag, MessageSquareText, Pin, Plus, Search, Settings2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { SchreibHinweis, ThemaKarte } from "@/components/treff/TreffBausteine";
import { TreffReiter } from "@/components/treff/TreffReiter";
import { kategorienListe, themenListe, treffStatus } from "@/lib/treff/laden";
import { darfThemaErstellen } from "@/lib/treff/treff";

export const metadata = { title: "TanzRaum Treff" };

// 💬 TanzRaum Treff – Community rund um den karnevalistischen Tanzsport (nur mit Konto; lesen ab FREE)
export default async function TreffStart({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/treff");
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const [status, kategorien] = await Promise.all([treffStatus(supabase), kategorienListe(supabase)]);
  const [treffer, angepinnt, aktuell, neu] = q
    ? [await themenListe(supabase, { ansicht: "neu", q, limit: 40 }), [], [], []]
    : await Promise.all([
        Promise.resolve([]),
        themenListe(supabase, { ansicht: "angepinnt", limit: 6 }),
        themenListe(supabase, { ansicht: "aktuell", limit: 6 }),
        themenListe(supabase, { ansicht: "neu", limit: 8 }),
      ]);
  const darfMeldungen = status.admin || status.rechte.includes("treff.meldungen_bearbeiten");
  // 📚 Wissensbeitraege sind eine Inhaltsart im Treff (neueste bzw. passend zur Suche)
  let wissenAbfrage = supabase.from("wissen_artikel").select("id, titel, einleitung").eq("status", "veroeffentlicht").order("veroeffentlicht_am", { ascending: false }).limit(q ? 10 : 3);
  if (q) wissenAbfrage = wissenAbfrage.or(`suchtext.wfts(german).${q.replace(/[(),]/g, " ")},titel.ilike.*${q.replace(/[(),*%]/g, " ")}*`);
  const { data: wissenRoh } = await wissenAbfrage;
  const wissen = (wissenRoh ?? []) as { id: string; titel: string; einleitung: string | null }[];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
            <MessageSquareText size={26} className="text-brand-red" /> TanzRaum Treff
          </h1>
          <p className="text-[14.5px] font-semibold text-brand-ink-soft">Fragen · Austauschen · Wissen teilen</p>
        </div>
        {darfThemaErstellen(status) && (
          <Link href="/dashboard/treff/neu" className="btn-primary mt-0 inline-flex min-h-11 items-center gap-1.5">
            <Plus size={17} /> Neues Thema
          </Link>
        )}
      </div>

      <TreffReiter aktiv="diskussionen" />

      <form action="/dashboard/treff" className="flex gap-2" role="search">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-brand-line bg-white px-3.5 focus-within:border-brand-red">
          <Search size={18} className="text-brand-ink-soft" />
          <input name="q" defaultValue={q} placeholder="Im Treff suchen – z. B. Sprungkraft, Kostüm, Wertung …" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" aria-label="Im Treff suchen" />
        </label>
        <button type="submit" className="min-h-12 rounded-2xl bg-brand-ink px-4 text-[14px] font-semibold text-white">
          Suchen
        </button>
      </form>

      {!status.schreiben && <SchreibHinweis unter16={status.unter_16} gesperrtBis={status.gesperrt_bis} />}

      {(darfMeldungen || status.admin) && (
        <div className="flex flex-wrap gap-2">
          {darfMeldungen && (
            <Link href="/dashboard/treff/meldungen" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13.5px] font-semibold hover:bg-brand-bg">
              <Flag size={15} className="text-brand-red" /> Meldungen
            </Link>
          )}
          {status.admin && (
            <Link href="/dashboard/treff/kategorien" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-line bg-white px-3 text-[13.5px] font-semibold hover:bg-brand-bg">
              <Settings2 size={15} /> Kategorien verwalten
            </Link>
          )}
        </div>
      )}

      {q ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[17px] font-bold text-brand-ink">
            Suchergebnisse für „{q}“ ({treffer.length})
          </h2>
          {treffer.length === 0 ? (
            <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>Nichts gefunden. Stell deine Frage doch als neues Thema!</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {treffer.map((t) => (
                <ThemaKarte key={t.id} t={t} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {angepinnt.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-1.5 text-[17px] font-bold text-brand-ink">
                <Pin size={18} className="text-brand-red" /> Angepinnte Themen
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {angepinnt.map((t) => (
                  <ThemaKarte key={t.id} t={t} kompakt />
                ))}
              </div>
            </section>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-1.5 text-[17px] font-bold text-brand-ink">
                <Flame size={18} className="text-brand-red" /> Aktuell diskutiert
              </h2>
              {aktuell.length === 0 ? (
                <p className={`${KARTE} text-[13.5px] text-brand-ink-soft`}>Noch keine Diskussionen – starte die erste!</p>
              ) : (
                aktuell.map((t) => <ThemaKarte key={t.id} t={t} kompakt />)
              )}
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-1.5 text-[17px] font-bold text-brand-ink">
                <Sparkles size={18} className="text-brand-gold" /> Neue Themen
              </h2>
              {neu.length === 0 ? <p className={`${KARTE} text-[13.5px] text-brand-ink-soft`}>Noch keine Themen.</p> : neu.map((t) => <ThemaKarte key={t.id} t={t} kompakt />)}
            </section>
          </div>
        </>
      )}

      {(wissen.length > 0 || !q) && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="flex flex-1 items-center gap-1.5 text-[17px] font-bold text-brand-ink">
              <BookOpen size={18} className="text-brand-purple" /> {q ? `Wissensbeiträge zu „${q}“` : "Wissensbeiträge"}
            </h2>
            <Link href="/dashboard/treff/wissen" className="text-[13px] font-semibold text-brand-red">
              Alle ansehen →
            </Link>
          </div>
          {wissen.length === 0 ? (
            <p className={`${KARTE} text-[13.5px] text-brand-ink-soft`}>Noch keine Wissensbeiträge – sie entstehen aus den besten Diskussionen hier im Treff.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3">
              {wissen.map((w) => (
                <Link key={w.id} href={`/dashboard/treff/wissen/${w.id}`} className="flex flex-col gap-1 rounded-2xl border border-brand-purple/30 bg-brand-purple-wash/40 p-3.5 hover:border-brand-purple">
                  <span className="text-[11.5px] font-bold text-brand-purple">📚 Wissensbeitrag</span>
                  <span className="text-[15px] font-bold leading-snug text-brand-ink">{w.titel}</span>
                  {w.einleitung && <span className="line-clamp-2 text-[12.5px] text-brand-ink-soft">{w.einleitung}</span>}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-bold text-brand-ink">Kategorien</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {kategorien
            .filter((k) => k.aktiv)
            .map((k) => (
              <Link key={k.id} href={`/dashboard/treff/kategorie/${k.id}`} className="flex items-center gap-3 rounded-2xl border border-brand-line bg-white p-3 hover:border-brand-red">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-bg text-[22px]">{k.emoji ?? "💬"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold text-brand-ink">{k.name}</span>
                  <span className="block truncate text-[12px] text-brand-ink-soft">
                    {k.themen} Thema{k.themen === 1 ? "" : "en"}
                    {k.beschreibung ? ` · ${k.beschreibung}` : ""}
                  </span>
                </span>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
