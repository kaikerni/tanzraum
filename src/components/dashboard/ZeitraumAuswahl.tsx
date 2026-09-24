"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

export const ZEITRAEUME = [4, 8, 12] as const;

export function ZeitraumAuswahl({ wochen }: { wochen: number }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Zeitraum</span>
      <select
        value={wochen}
        onChange={(e) => {
          const neu = new URLSearchParams(params.toString());
          neu.set("wochen", e.target.value);
          router.replace(`?${neu.toString()}`, { scroll: false });
        }}
        className="appearance-none rounded-lg border border-brand-line bg-white py-1.5 pl-3 pr-8 text-[12.5px] font-medium text-brand-ink outline-none focus:border-brand-red"
      >
        {ZEITRAEUME.map((w) => (
          <option key={w} value={w}>
            Letzte {w} Wochen
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-brand-ink-soft" />
    </label>
  );
}
