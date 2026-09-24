"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X, HelpCircle } from "lucide-react";
import { sichtbareNav } from "@/lib/navigation";

const BEVORZUGT = ["/dashboard", "/dashboard/training", "/dashboard/kalender", "/dashboard/nachrichten"];

export function MobileNav({
  bereiche,
  ungeleseneNachrichten,
}: {
  bereiche: string[];
  ungeleseneNachrichten: number;
}) {
  const pathname = usePathname();
  const [offen, setOffen] = useState(false);
  const alle = sichtbareNav(new Set(bereiche));

  const leiste = [
    ...BEVORZUGT.map((href) => alle.find((n) => n.href === href)).filter((n) => n !== undefined),
    ...alle.filter((n) => !BEVORZUGT.includes(n.href)),
  ].slice(0, 4);
  const rest = alle.filter((n) => !leiste.includes(n));

  useEffect(() => setOffen(false), [pathname]);

  useEffect(() => {
    if (!offen) return;
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [offen]);

  return (
    <>
      {offen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Alle Bereiche">
          <button
            type="button"
            aria-label="Schließen"
            className="absolute inset-0 bg-brand-navy/40"
            onClick={() => setOffen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] pt-3 shadow-[0_-12px_40px_-12px_rgba(27,33,48,0.35)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-brand-line" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-brand-ink">Alle Bereiche</h2>
              <button
                type="button"
                onClick={() => setOffen(false)}
                aria-label="Schließen"
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-brand-bg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {rest.map((item) => {
                const Icon = item.icon;
                const aktiv = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-[12.5px] font-medium ${
                      aktiv ? "border-brand-red bg-brand-red-wash text-brand-red-deep" : "border-brand-line text-brand-ink"
                    }`}
                  >
                    <Icon size={22} strokeWidth={1.9} />
                    <span className="max-w-full hyphens-auto break-words text-[12px] leading-tight">{item.label}</span>
                  </Link>
                );
              })}
              <Link
                href="/dashboard/hilfe"
                className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border border-brand-gold-light px-2 py-3 text-center text-[12.5px] font-medium text-brand-gold"
              >
                <HelpCircle size={22} strokeWidth={1.9} />
                <span className="leading-tight">Support &amp; Hilfe</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {leiste.map((item) => {
            const Icon = item.icon;
            const aktiv = pathname === item.href;
            const zaehler = item.href === "/dashboard/nachrichten" ? ungeleseneNachrichten : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={aktiv ? "page" : undefined}
                className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  aktiv ? "text-brand-red" : "text-brand-ink-soft"
                }`}
              >
                {aktiv && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand-red" />}
                <span className="relative">
                  <Icon size={22} strokeWidth={aktiv ? 2.3 : 1.9} />
                  {zaehler > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[9.5px] font-bold text-white">
                      {zaehler > 99 ? "99+" : zaehler}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOffen((v) => !v)}
            aria-expanded={offen}
            className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              offen ? "text-brand-red" : "text-brand-ink-soft"
            }`}
          >
            <MoreHorizontal size={22} />
            Mehr
          </button>
        </div>
      </nav>
    </>
  );
}
