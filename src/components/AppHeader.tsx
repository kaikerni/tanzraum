"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, MessageSquare, ChevronDown, LogOut, Sparkles } from "lucide-react";
import { versionText } from "@/lib/version";
import { signOut } from "@/app/actions";
import { KaiBegleiter } from "@/components/kai/KaiBegleiter";
import type { KaiKontext } from "@/lib/kai/typen";

function initialen(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Zaehler({ anzahl }: { anzahl: number }) {
  if (anzahl <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white ring-2 ring-white">
      {anzahl > 99 ? "99+" : anzahl}
    </span>
  );
}

export function AppHeader({
  name,
  anzeigeName,
  untertitel,
  ungeleseneNachrichten,
  nachrichtenHref = "/dashboard/nachrichten",
  ungeleseneBenachrichtigungen,
  kai,
}: {
  name: string;
  anzeigeName: string;
  untertitel: string;
  ungeleseneNachrichten: number;
  // FREE hat keine Chatuebersicht: das Symbol fuehrt zu „Nachrichten“ auf dem Dashboard
  nachrichtenHref?: string;
  ungeleseneBenachrichtigungen: number;
  kai?: KaiKontext;
}) {
  const [menuOffen, setMenuOffen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sucheRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Strg + K / Cmd + K springt ins Suchfeld (auf dem Handy: Suchseite)
  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (sucheRef.current && sucheRef.current.offsetParent !== null) sucheRef.current.focus();
        else router.push("/dashboard/suche");
      }
    }
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [router]);

  useEffect(() => {
    if (!menuOffen) return;
    function schliessen(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOffen(false);
    }
    document.addEventListener("mousedown", schliessen);
    return () => document.removeEventListener("mousedown", schliessen);
  }, [menuOffen]);

  return (
    // Globaler Header aller Rollen: grosses TanzRaum-Logo (Proportionen bleiben), kompakte Suche, Kai, Glocke, Nachrichten, Profil.
    // Hoehe 64 px (Handy) / 84 px (ab md) – die Chat-Ansichten rechnen mit diesen Werten.
    <header className="relative z-20 flex h-16 shrink-0 items-center gap-2 border-b border-brand-line bg-white px-3 sm:gap-4 sm:px-4 md:h-[84px] md:px-6">
      <Link href="/dashboard" className="flex min-w-0 flex-1 items-center sm:flex-none sm:shrink-0" aria-label="TanzRaum Startseite">
        <Image
          src="/tanzraum-logo-header.webp"
          alt="TanzRaum – Die Plattform für Tanzsport & Gemeinschaft"
          width={1392}
          height={207}
          className="h-auto max-h-[44px] w-full min-w-0 object-contain object-left sm:h-12 sm:max-h-none sm:w-auto md:h-[58px] lg:h-[62px] xl:h-[68px]"
          priority
        />
      </Link>

      <form
        action="/dashboard/suche"
        role="search"
        className="mx-auto hidden min-w-[180px] max-w-[380px] flex-1 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 py-2 transition-all focus-within:border-brand-red focus-within:shadow-[var(--shadow)] xl:flex"
      >
        <Search size={17} className="shrink-0 text-brand-ink-soft" />
        <input
          ref={sucheRef}
          type="search"
          name="q"
          minLength={2}
          maxLength={100}
          autoComplete="off"
          placeholder="Suche nach Mitgliedern, Terminen, Dateien, Nachrichten …"
          aria-label="Suche"
          className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-brand-ink-soft"
        />
        <kbd className="hidden shrink-0 rounded-md border border-brand-line bg-brand-bg px-1.5 py-0.5 text-[11px] font-medium text-brand-ink-soft 2xl:block">
          Strg + K
        </kbd>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-3 xl:ml-0">
        <Link
          href="/dashboard/suche"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-ink transition-colors hover:bg-brand-bg sm:h-10 sm:w-10 xl:hidden"
          aria-label="Suche"
          title="Suche"
        >
          <Search size={20} />
        </Link>
        {kai && <KaiBegleiter kontext={kai} />}
        <Link
          href="/dashboard/benachrichtigungen"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-brand-ink transition-colors hover:bg-brand-bg sm:h-10 sm:w-10"
          aria-label={`Benachrichtigungen${ungeleseneBenachrichtigungen > 0 ? ` (${ungeleseneBenachrichtigungen} ungelesen)` : ""}`}
          title="Benachrichtigungen"
        >
          <Bell size={20} />
          <Zaehler anzahl={ungeleseneBenachrichtigungen} />
        </Link>
        <Link
          href={nachrichtenHref}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-brand-line text-brand-ink transition-colors hover:bg-brand-bg sm:h-10 sm:w-10"
          aria-label={`Nachrichten${ungeleseneNachrichten > 0 ? ` (${ungeleseneNachrichten} ungelesen)` : ""}`}
          title="Nachrichten"
        >
          <MessageSquare size={18} />
          <Zaehler anzahl={ungeleseneNachrichten} />
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOffen((v) => !v)}
            aria-expanded={menuOffen}
            aria-haspopup="menu"
            className="flex items-center gap-2.5 rounded-xl py-1 pl-0.5 pr-0.5 transition-colors hover:bg-brand-bg sm:pl-1 sm:pr-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-[13px] font-bold text-white sm:h-10 sm:w-10 md:h-11 md:w-11">
              {initialen(name)}
            </span>
            <span className="hidden text-left lg:block">
              <span className="block text-[14px] font-bold leading-tight text-brand-ink">{anzeigeName}</span>
              <span className="block text-[12px] leading-tight text-brand-ink-soft">{untertitel}</span>
            </span>
            <ChevronDown size={16} className="hidden text-brand-ink-soft sm:block" />
          </button>

          {menuOffen && (
            <div
              role="menu"
              className="absolute right-0 top-[52px] z-30 w-52 rounded-xl border border-brand-line bg-white py-1.5 shadow-[var(--shadow-hover)]"
            >
              <div className="border-b border-brand-line px-3.5 pb-2 pt-1 lg:hidden">
                <div className="text-[13px] font-bold text-brand-ink">{anzeigeName}</div>
                <div className="text-[11.5px] text-brand-ink-soft">{untertitel}</div>
              </div>
              <Link
                href="/dashboard/neu"
                role="menuitem"
                onClick={() => setMenuOffen(false)}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-brand-ink hover:bg-brand-bg"
              >
                <Sparkles size={15} className="text-brand-gold" />
                Was ist neu?
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-brand-ink hover:bg-brand-bg"
                >
                  <LogOut size={15} />
                  Abmelden
                </button>
              </form>
              <p className="border-t border-brand-line px-3.5 pb-1 pt-2 text-[11px] text-brand-ink-faint">{versionText()}</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
