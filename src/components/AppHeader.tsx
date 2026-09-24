"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, MessageCircle, ChevronDown, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";

export function AppHeader({
  name,
  rolle,
  ungeleseneNachrichten,
}: {
  name: string;
  rolle: string;
  ungeleseneNachrichten: number;
}) {
  const [menuOffen, setMenuOffen] = useState(false);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-brand-line bg-white px-6">
      <Link href="/dashboard" className="flex shrink-0 items-center">
        <Image
          src="/tanzraum-logo-banner.webp"
          alt="TanzRaum"
          width={168}
          height={44}
          className="h-10 w-auto"
          priority
        />
      </Link>

      <div className="mx-auto flex max-w-xl flex-1 items-center gap-2 rounded-full border border-brand-line bg-brand-bg px-4 py-2">
        <Search size={16} className="text-brand-ink-soft" />
        <input
          type="search"
          placeholder="Suche nach Mitgliedern, Terminen, Dateien ..."
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-brand-ink-soft"
        />
        <kbd className="rounded border border-brand-line bg-white px-1.5 py-0.5 text-[11px] text-brand-ink-soft">
          Strg + K
        </kbd>
      </div>

      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-bg"
        aria-label="Benachrichtigungen"
      >
        <Bell size={18} />
      </button>
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-bg"
        aria-label="Nachrichten"
      >
        <MessageCircle size={18} />
        {ungeleseneNachrichten > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
            {ungeleseneNachrichten}
          </span>
        )}
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOffen((v) => !v)}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-brand-bg"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white">
            {name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <span className="hidden text-left sm:block">
            <span className="block text-[13px] font-semibold leading-tight text-brand-ink">{name}</span>
            <span className="block text-[11px] leading-tight text-brand-ink-soft">{rolle}</span>
          </span>
          <ChevronDown size={15} className="text-brand-ink-soft" />
        </button>

        {menuOffen && (
          <div className="absolute right-0 top-11 z-10 w-44 rounded-xl border border-brand-line bg-white py-1 shadow-lg">
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-brand-ink hover:bg-brand-bg"
              >
                <LogOut size={15} />
                Abmelden
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
