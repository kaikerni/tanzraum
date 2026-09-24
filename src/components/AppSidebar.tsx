"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Activity,
  Trophy,
  Users,
  Handshake,
  MessageSquare,
  Folder,
  Car,
  Music,
  Wallet,
  BarChart3,
  Settings2,
  Settings,
  HelpCircle,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/verein", label: "Mein Verein", icon: Home },
  { href: "/dashboard/kalender", label: "Kalender", icon: Calendar },
  { href: "/dashboard/training", label: "Training", icon: Activity },
  { href: "/dashboard/turniere", label: "Turniere", icon: Trophy },
  { href: "/dashboard/mitglieder", label: "Mitglieder", icon: Users },
  { href: "/dashboard/trainer-netzwerk", label: "Trainer-Netzwerk", icon: Handshake },
  { href: "/dashboard/nachrichten", label: "Nachrichten", icon: MessageSquare },
  { href: "/dashboard/dateien", label: "Dateien", icon: Folder },
  { href: "/dashboard/fahrgemeinschaften", label: "Fahrgemeinschaften", icon: Car },
  { href: "/dashboard/musik", label: "Musik", icon: Music },
  { href: "/dashboard/finanzen", label: "Finanzen", icon: Wallet },
  { href: "/dashboard/statistiken", label: "Statistiken", icon: BarChart3 },
  { href: "/dashboard/vereinsverwaltung", label: "Vereinsverwaltung", icon: Settings2 },
  { href: "/dashboard/einstellungen", label: "Einstellungen", icon: Settings },
];

export function AppSidebar({
  name,
  rolle,
}: {
  name: string;
  rolle: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-brand-line bg-white px-3 py-5">
      <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-brand-red-wash to-brand-gold-wash px-3 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white shadow-sm">
          {name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-semibold text-brand-ink">{name}</div>
          <div className="text-xs text-brand-ink-soft">{rolle}</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150 ${
                active
                  ? "bg-brand-red-wash text-brand-red-deep"
                  : "text-brand-ink-soft hover:translate-x-0.5 hover:bg-brand-bg hover:text-brand-ink"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-red" />
              )}
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/dashboard/hilfe"
        className="mt-3 flex items-center gap-2 rounded-lg border border-brand-line px-3 py-2.5 text-[13px] font-medium text-brand-ink-soft transition-colors hover:border-brand-gold hover:bg-brand-gold-wash hover:text-brand-ink"
      >
        <HelpCircle size={16} />
        Support &amp; Hilfe
      </Link>
    </aside>
  );
}
