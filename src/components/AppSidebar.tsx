"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Building2, HelpCircle, Heart } from "lucide-react";
import { sichtbareNav } from "@/lib/navigation";

export type SidebarKontext = {
  titel: string;
  untertitel: string;
  istPlattformAdmin: boolean;
};

export function AppSidebar({
  kontext,
  bereiche,
  ungeleseneNachrichten,
}: {
  kontext: SidebarKontext;
  bereiche: string[];
  ungeleseneNachrichten: number;
}) {
  const pathname = usePathname();
  const eintraege = sichtbareNav(new Set(bereiche));
  const KontextIcon = kontext.istPlattformAdmin ? Crown : Building2;

  return (
    <aside className="hidden shrink-0 flex-col border-r border-brand-line bg-white md:flex md:w-[76px] xl:w-[240px]">
      <div className="flex flex-1 flex-col overflow-y-auto px-2.5 py-4 xl:px-3.5 xl:py-5">
        <div className="mb-4 flex items-center justify-center gap-3 rounded-xl xl:justify-start xl:px-2 xl:py-1">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-brand-gold-light bg-brand-gold-wash text-brand-gold"
            title={`${kontext.titel} · ${kontext.untertitel}`}
          >
            <KontextIcon size={20} strokeWidth={2.2} />
          </span>
          <div className="hidden min-w-0 xl:block">
            <div className="truncate text-[14px] font-bold text-brand-ink">{kontext.titel}</div>
            <div className="truncate text-[12px] text-brand-ink-soft">{kontext.untertitel}</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Hauptnavigation">
          {eintraege.map((item) => {
            const aktiv = pathname === item.href;
            const Icon = item.icon;
            const zaehler = item.href === "/dashboard/nachrichten" ? ungeleseneNachrichten : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={aktiv ? "page" : undefined}
                className={`relative flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors duration-150 xl:justify-start ${
                  aktiv
                    ? "bg-brand-red text-white shadow-[0_6px_16px_-8px_rgba(225,29,46,0.7)]"
                    : "text-brand-ink hover:bg-brand-bg"
                }`}
              >
                <Icon size={19} strokeWidth={aktiv ? 2.3 : 1.9} className="shrink-0" />
                <span className="hidden flex-1 truncate xl:block">{item.label}</span>
                {zaehler > 0 && (
                  <span
                    className={`absolute right-1.5 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold xl:static xl:h-5 xl:min-w-5 xl:text-[11px] ${
                      aktiv ? "bg-white text-brand-red" : "bg-brand-red text-white"
                    }`}
                  >
                    {zaehler > 99 ? "99+" : zaehler}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-5 flex flex-col gap-3 pt-2">
          <Link
            href="/dashboard/hilfe"
            title="Support & Hilfe"
            className="flex items-center justify-center gap-2 rounded-xl border border-brand-gold-light px-3 py-2.5 text-[13.5px] font-medium text-brand-gold transition-colors hover:bg-brand-gold-wash xl:justify-start"
          >
            <HelpCircle size={18} className="shrink-0" />
            <span className="hidden xl:inline">Support &amp; Hilfe</span>
          </Link>
          <div className="hidden px-1 xl:block">
            <div className="text-[11.5px] text-brand-ink-faint">TanzRaum v1.0</div>
            <div className="text-[11.5px] text-brand-ink-faint">Gemeinsam. Organisiert. Verbunden.</div>
            <p className="mt-4 -rotate-6 font-[family-name:var(--font-script)] text-[21px] leading-snug text-brand-ink">
              Mehr als Tanz –<br />
              eine Gemeinschaft!{" "}
              <Heart size={18} className="inline fill-brand-red text-brand-red" />
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
