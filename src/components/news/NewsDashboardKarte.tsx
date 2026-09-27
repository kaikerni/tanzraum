import Link from "next/link";
import { Newspaper, AlertTriangle, BarChart3 } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import type { News, Umfrage } from "@/lib/news/getNews";

// Relevante News und offene Umfragen auf dem Dashboard
export function NewsDashboardKarte({ news, umfragen }: { news: News[]; umfragen: Umfrage[] }) {
  const offen = umfragen.filter((u) => u.istEmpfaenger && new Date(u.endetAm).getTime() > Date.now() && u.meine.length === 0);
  if (news.length === 0 && offen.length === 0) return null;
  return (
    <section className={KARTE}>
      <KarteKopf icon={Newspaper} titel="News" alleHref="/dashboard/news" />
      <ul className="flex flex-col divide-y divide-brand-line">
        {offen.slice(0, 2).map((u) => (
          <li key={u.id}>
            <Link href="/dashboard/news" className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-brand-bg">
              <BarChart3 size={18} className="shrink-0 text-brand-blue" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-brand-ink">Umfrage: {u.frage}</span>
                <span className="block text-[12px] text-brand-ink-soft">{u.vereinName} · noch nicht abgestimmt</span>
              </span>
            </Link>
          </li>
        ))}
        {news.slice(0, 3).map((n) => (
          <li key={n.id}>
            <Link href="/dashboard/news" className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-brand-bg">
              {n.wichtig ? <AlertTriangle size={18} className="shrink-0 text-brand-red" /> : <Newspaper size={18} className="shrink-0 text-brand-ink-soft" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-brand-ink">{n.titel}</span>
                <span className="block truncate text-[12px] text-brand-ink-soft">
                  {n.vereinName} · {new Date(n.erstelltAm).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
                </span>
              </span>
              {n.istEmpfaenger && !n.gelesenAm && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-red" aria-label="ungelesen" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
