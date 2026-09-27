import Link from "next/link";

// Einheitliche rechtliche Navigation (Footer): oeffentliche Seiten und angemeldeter Bereich, auch mobil
const LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/nutzungsbedingungen", label: "Nutzungsbedingungen" },
  { href: "/nutzungsbedingungen#widerruf", label: "Widerruf" },
  { href: "/lizenz", label: "Lizenzen" },
  { href: "/kontakt", label: "Kontakt" },
];

export function RechtsLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Rechtliches" className={`flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-brand-ink-faint ${className}`}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-brand-ink hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function Fusszeile({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-col items-center gap-1.5 border-t border-brand-line pt-4 text-center ${className}`}>
      <RechtsLinks className="justify-center" />
      <p className="text-[11.5px] text-brand-ink-faint">© {new Date().getFullYear()} TanzRaum · Cookies nur, soweit technisch notwendig – kein Tracking</p>
    </footer>
  );
}
