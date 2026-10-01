import { KaiFigur } from "@/components/kai/KaiFigur";
import type { KaiPose } from "@/lib/kai/typen";

// Kais Sprechblase (eigene Flaeche, ueberlappt Kai nie). spitze: Richtung zu Kai.
export function KaiSprechblase({
  children,
  spitze = "unten",
  className = "",
}: {
  children: React.ReactNode;
  spitze?: "unten" | "rechts";
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-brand-line bg-white px-4 py-2.5 text-[14.5px] font-semibold leading-snug text-brand-ink shadow-[var(--shadow-hover)] [overflow-wrap:anywhere] ${className}`}
    >
      {children}
      {spitze === "unten" ? (
        <span className="absolute -bottom-[7px] left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 border-b border-r border-brand-line bg-white sm:left-12" aria-hidden />
      ) : (
        <span className="absolute -right-[7px] bottom-5 h-3.5 w-3.5 rotate-45 border-r border-t border-brand-line bg-white" aria-hidden />
      )}
    </div>
  );
}

// Grosser Auftritt von Kai (z. B. Startseite): Sprechblase im eigenen Platz UEBER der Figur –
// sie ueberlappt Kai nie, lange Texte brechen innerhalb der Blase um.
export function KaiBuehne({
  spruch,
  pose = "begruessung",
  className = "",
  priority = false,
}: {
  spruch: React.ReactNode;
  pose?: KaiPose;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`mx-auto flex w-full max-w-[420px] flex-col items-center ${className}`}>
      <KaiSprechblase className="mb-3 max-w-[300px] self-center text-center sm:self-start sm:text-left">{spruch}</KaiSprechblase>
      <KaiFigur
        pose={pose}
        priority={priority}
        className="h-[300px] w-[200px] sm:h-[420px] sm:w-[280px] lg:h-[470px] lg:w-[313px]"
        sizes="(min-width: 1024px) 313px, (min-width: 640px) 280px, 200px"
        alt="Kai, der TanzRaum-Begleiter, in schwarz-rot-goldener Garde-Uniform mit Federhut und Tablet"
      />
    </div>
  );
}
