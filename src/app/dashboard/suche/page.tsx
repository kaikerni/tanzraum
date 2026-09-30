import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getZugriff } from "@/lib/dashboard/getBereiche";
import { aktiveAnsicht } from "@/lib/admin/ansichtLesen";
import { ansichtZugriff } from "@/lib/admin/ansicht";
import { KARTE } from "@/components/dashboard/Karten";
import { globaleSuche } from "@/lib/suche";

export const metadata = { title: "Suche – TanzRaum" };

export default async function SuchSeite({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/suche");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");

  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const [zugriff, ansicht] = await Promise.all([getZugriff(supabase, daten.istPlattformAdmin), aktiveAnsicht()]);
  // In „Ansicht als …“ sucht die Administration wie die gewaehlte Rolle (Beispieldaten)
  const navZugriff = ansicht ? { ...ansichtZugriff(ansicht), musikAn: zugriff.musikAn } : zugriff;
  const gruppen = q.length >= 2 ? await globaleSuche(supabase, q, navZugriff, daten.istPlattformAdmin && !ansicht) : [];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Search size={24} className="text-brand-red" /> Suche
      </h1>
      <form action="/dashboard/suche" className="flex gap-2">
        <label className="field min-w-0 flex-1">
          <span className="sr-only">Suchbegriff</span>
          <input name="q" type="search" defaultValue={q} placeholder="Mitglieder, Termine, Dateien, Nachrichten …" autoFocus={!q} autoComplete="off" />
        </label>
        <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
          <Search size={16} /> Suchen
        </button>
      </form>

      {q.length < 2 ? (
        <p className="text-[13.5px] text-brand-ink-soft">Mindestens 2 Zeichen eingeben. Gesucht wird nur in dem, was du in TanzRaum sehen darfst.</p>
      ) : gruppen.length === 0 ? (
        <section className={`${KARTE} py-8 text-center`}>
          <p className="text-[15px] font-bold text-brand-ink">Nichts gefunden für „{q}“</p>
          <p className="mt-1 text-[13px] text-brand-ink-soft">Versuche einen kürzeren oder anderen Begriff.</p>
        </section>
      ) : (
        gruppen.map((g) => (
          <section key={g.art} className={KARTE}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-brand-ink">{g.titel}</h2>
              {g.mehrHref && (
                <Link href={g.mehrHref} className="text-[12.5px] font-semibold text-brand-red">
                  Bereich öffnen →
                </Link>
              )}
            </div>
            <ul className="divide-y divide-brand-line">
              {g.treffer.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-brand-bg">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-brand-ink">{t.titel}</span>
                      {t.zeile && <span className="block truncate text-[12.5px] text-brand-ink-soft">{t.zeile}</span>}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-brand-ink-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
