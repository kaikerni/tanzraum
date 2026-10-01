import Link from "next/link";
import { Globe, Sparkles, ChevronRight } from "lucide-react";

// Dezenter Dashboard-Hinweis auf das TanzRaum-Netzwerk (Spotlights selbst gibt es nur im Netzwerk)
export function NetzwerkHinweis({ tarif, neueSpotlights }: { tarif: "free" | "basic" | "verein"; neueSpotlights: number }) {
  const spotlight = neueSpotlights > 0;
  const href = spotlight ? "/dashboard/netzwerk/spotlight" : tarif === "free" ? "/dashboard/netzwerk/suche" : "/dashboard/netzwerk";
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white px-4 py-3 shadow-[var(--shadow)] transition-colors hover:border-brand-red"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-wash text-brand-red">
        {spotlight ? <Sparkles size={19} /> : <Globe size={19} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-brand-ink">TanzRaum-Netzwerk</span>
        <span className="block truncate text-[13px] text-brand-ink-soft">
          {spotlight
            ? `${neueSpotlights} ${neueSpotlights === 1 ? "neues Spotlight" : "neue Spotlights"} – jetzt im Netzwerk ansehen`
            : tarif === "free"
              ? "Nutzer suchen, Profile ansehen und eine Nachricht senden"
              : "Buddys, Spotlights, Map und Vereine entdecken"}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-brand-ink-faint" />
    </Link>
  );
}
