import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { istFertig } from "@/lib/navigation";

export function KarteKopf({
  icon: Icon,
  titel,
  untertitel,
  alleHref,
  rechts,
}: {
  icon: LucideIcon;
  titel: string;
  untertitel?: string;
  alleHref?: string;
  rechts?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <Icon size={20} strokeWidth={1.9} className="mt-0.5 shrink-0 text-brand-ink" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15.5px] font-bold leading-snug text-brand-ink">{titel}</h2>
        {untertitel && <p className="mt-0.5 text-[12.5px] text-brand-ink-soft">{untertitel}</p>}
      </div>
      {rechts}
      {alleHref && istFertig(alleHref) && (
        <Link
          href={alleHref}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-brand-ink hover:text-brand-red"
        >
          Alle anzeigen <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
