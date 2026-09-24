"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, MessageSquare, ChevronDown, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";

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
  ungeleseneBenachrichtigungen,
}: {
  name: string;
  anzeigeName: string;
  untertitel: string;
  ungeleseneNachrichten: number;
  ungeleseneBenachrichtigungen: number;
}) {
  const [menuOffen, setMenuOffen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOffen) return;
    function schliessen(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOffen(false);
    }
    document.addEventListener("mousedown", schliessen);
    return () => document.removeEventListener("mousedown", schliessen);
  }, [menuOffen]);

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center gap-3 border-b border-brand-line bg-white px-4 sm:gap-4 md:h-[76px] md:px-6">
      <Link href="/dashboard" className="flex shrink-0 items-center" aria-label="TanzRaum Startseite">
        <Image
          src="/tanzraum-logo-mark.webp"
          alt="TanzRaum"
          width={44}
          height={44}
          className="h-10 w-10 sm:hidden"
          priority
        />
        <Image
          src="/tanzraum-logo-header.webp"
          alt="TanzRaum – Die Plattform für Tanzsport & Gemeinschaft"
          width={1864}
          height={458}
          className="hidden h-11 w-auto sm:block md:h-[52px]"
          priority
        />
      </Link>

      <div className="mx-auto hidden max-w-xl flex-1 items-center gap-2.5 rounded-xl border border-brand-line bg-white px-4 py-2.5 transition-all focus-within:border-brand-red focus-within:shadow-[var(--shadow)] md:flex">
        <Search size={17} className="shrink-0 text-brand-ink-soft" />
        <input
          type="search"
          placeholder="Suche nach Mitgliedern, Terminen, Dateien, Nachrichten …"
          aria-label="Suche"
          className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-brand-ink-soft"
        />
        <kbd className="hidden shrink-0 rounded-md border border-brand-line bg-brand-bg px-1.5 py-0.5 text-[11px] font-medium text-brand-ink-soft lg:block">
          Strg + K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3 md:ml-0">
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-brand-ink transition-colors hover:bg-brand-bg"
          aria-label={`Benachrichtigungen${ungeleseneBenachrichtigungen > 0 ? ` (${ungeleseneBenachrichtigungen} ungelesen)` : ""}`}
        >
          <Bell size={20} />
          <Zaehler anzahl={ungeleseneBenachrichtigungen} />
        </button>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-brand-line text-brand-ink transition-colors hover:bg-brand-bg"
          aria-label={`TanzRaum-Chat${ungeleseneNachrichten > 0 ? ` (${ungeleseneNachrichten} ungelesen)` : ""}`}
        >
          <MessageSquare size={18} />
          <Zaehler anzahl={ungeleseneNachrichten} />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOffen((v) => !v)}
            aria-expanded={menuOffen}
            aria-haspopup="menu"
            className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-1.5 transition-colors hover:bg-brand-bg sm:pr-2"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-red text-[13px] font-bold text-white md:h-11 md:w-11">
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
