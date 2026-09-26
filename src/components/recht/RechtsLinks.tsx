import Link from "next/link";

// Impressum, Datenschutz, Nutzungsbedingungen -- auf oeffentlichen Seiten und in der App erreichbar
export function RechtsLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Rechtliches" className={`flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-brand-ink-faint ${className}`}>
      <Link href="/impressum" className="hover:text-brand-ink hover:underline">
        Impressum
      </Link>
      <Link href="/datenschutz" className="hover:text-brand-ink hover:underline">
        Datenschutz
      </Link>
      <Link href="/nutzungsbedingungen" className="hover:text-brand-ink hover:underline">
        Nutzungsbedingungen
      </Link>
    </nav>
  );
}
