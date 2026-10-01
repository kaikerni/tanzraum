"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, NETZWERK } from "@/lib/navigation";

// Reiter des TanzRaum-Netzwerks (dieselben Unterpunkte wie in der Seitenleiste; nur die freigegebenen)
export function NetzwerkReiter({ erlaubt, anfragen = 0 }: { erlaubt: string[]; anfragen?: number }) {
  const pathname = usePathname();
  // Profile haben ihren eigenen Zurueck-Link
  if (pathname.startsWith(`${NETZWERK}/person/`) || pathname.startsWith(`${NETZWERK}/verein/`)) return null;
  const reiter = NAV.filter((n) => n.eltern === NETZWERK && erlaubt.includes(n.href));
  if (reiter.length < 2) return null;
  return (
    <nav className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0" aria-label="TanzRaum-Netzwerk">
      <div className="flex w-max gap-1 rounded-xl bg-white p-1 shadow-[var(--shadow)] sm:w-auto">
        {reiter.map(({ href, label, icon: Icon }) => {
          const aktiv = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={aktiv ? "page" : undefined}
              className={`relative inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold transition-colors ${
                aktiv ? "bg-brand-red text-white" : "text-brand-ink-soft hover:bg-brand-bg hover:text-brand-ink"
              }`}
            >
              <Icon size={16} /> {label}
              {href.endsWith("/anfragen") && anfragen > 0 && (
                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${aktiv ? "bg-white text-brand-red" : "bg-brand-red text-white"}`}>
                  {anfragen}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
