"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Crown, Building2, HelpCircle, Heart, ChevronDown } from "lucide-react";
import { navGruppen, navPfad, type NavEintrag, type Zugriff } from "@/lib/navigation";

export type SidebarKontext = {
  titel: string;
  untertitel: string;
  istPlattformAdmin: boolean;
};

function NavLink({ item, aktiv, zaehler, klein = false, mitPfeil = false }: { item: NavEintrag; aktiv: boolean; zaehler: number; klein?: boolean; mitPfeil?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={aktiv ? "page" : undefined}
      className={`relative flex items-center justify-center rounded-xl font-medium transition-colors duration-150 xl:justify-start ${
        klein ? "gap-2.5 px-2.5 py-2 text-[13.5px]" : "gap-3 px-3 py-2.5 text-[14px]"
      } ${mitPfeil ? "xl:pr-9" : ""} ${aktiv ? "bg-brand-red text-white shadow-[0_6px_16px_-8px_rgba(225,29,46,0.7)]" : klein ? "text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink" : "text-brand-ink hover:bg-brand-bg"}`}
    >
      <Icon size={klein ? 17 : 19} strokeWidth={aktiv ? 2.3 : 1.9} className="shrink-0" />
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
}

export function AppSidebar({
  kontext,
  zugriff,
  ungeleseneNachrichten,
  neueAbmeldungen = 0,
  buddyAnfragen = 0,
}: {
  kontext: SidebarKontext;
  zugriff: Zugriff;
  ungeleseneNachrichten: number;
  // Ungelesene Hinweise „Neue Abmeldung“ (Trainer) -> Badge am Menuepunkt Training
  neueAbmeldungen?: number;
  // Offene eingehende Buddy-Anfragen -> Badge am Unterpunkt „Buddy-Anfragen“
  buddyAnfragen?: number;
}) {
  const pathname = usePathname();
  const gruppen = navGruppen(zugriff);
  // Bereich mit Unterpunkten: offen, solange man sich darin befindet (oder per Pfeil geoeffnet)
  const imBereich = (g: (typeof gruppen)[number]) =>
    pathname === g.eintrag.href || pathname.startsWith(`${g.eintrag.href}/`) || g.unterpunkte.some((u) => pathname === navPfad(u.href) || pathname.startsWith(`${navPfad(u.href)}/`));
  const [aufgeklappt, setAufgeklappt] = useState<Record<string, boolean>>({});
  useEffect(() => setAufgeklappt({}), [pathname]);
  const KontextIcon = kontext.istPlattformAdmin ? Crown : Building2;
  const zaehlerFuer = (n: NavEintrag) =>
    n.href === "/dashboard/nachrichten" ? ungeleseneNachrichten : n.href === "/dashboard/training" ? neueAbmeldungen : n.href === "/dashboard/netzwerk/anfragen" ? buddyAnfragen : 0;

  return (
    <aside className="hidden shrink-0 flex-col border-r border-brand-line bg-white md:flex md:w-[76px] xl:w-[256px]">
      <div className="flex flex-1 flex-col overflow-y-auto px-2.5 py-4 [scrollbar-width:thin] xl:px-3 xl:py-5">
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
          {gruppen.map((g) => {
            const offen = g.unterpunkte.length > 0 && (aufgeklappt[g.eintrag.href] ?? imBereich(g));
            return (
              <div key={g.eintrag.href} className="flex flex-col gap-1">
                <div className="relative">
                  <NavLink item={g.eintrag} aktiv={pathname === g.eintrag.href} zaehler={zaehlerFuer(g.eintrag)} mitPfeil={g.unterpunkte.length > 0} />
                  {g.unterpunkte.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAufgeklappt((a) => ({ ...a, [g.eintrag.href]: !offen }))}
                      aria-expanded={offen}
                      aria-label={`${g.eintrag.label}: Unterpunkte ${offen ? "einklappen" : "aufklappen"}`}
                      className={`absolute right-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg xl:flex ${
                        pathname === g.eintrag.href ? "text-white hover:bg-white/15" : "text-brand-ink-soft hover:bg-brand-line"
                      }`}
                    >
                      <ChevronDown size={16} className={`transition-transform ${offen ? "" : "-rotate-90"}`} />
                    </button>
                  )}
                </div>
                {offen && (
                  <div className="flex flex-col gap-0.5 xl:ml-3.5 xl:border-l xl:border-brand-line xl:pl-1.5">
                    {g.unterpunkte.map((u) => (
                      <NavLink key={u.href} item={u} aktiv={!u.href.includes("#") && pathname === u.href} zaehler={zaehlerFuer(u)} klein />
                    ))}
                  </div>
                )}
              </div>
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
            <Image
              src="/tanzraum-taenzer-illustration.webp"
              alt=""
              width={700}
              height={491}
              className="mt-4 h-auto w-full select-none"
            />
            <p className="-mt-3 -rotate-6 font-[family-name:var(--font-script)] text-[21px] leading-snug text-brand-ink">
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
