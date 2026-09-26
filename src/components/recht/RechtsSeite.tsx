import Link from "next/link";
import Image from "next/image";
import { RechtsLinks } from "./RechtsLinks";

export const STAND = "26.09.2026";

// Platzhalter fuer Angaben, die der Betreiber noch eintragen bzw. rechtlich pruefen lassen muss
export function Todo({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-brand-amber-wash px-1 font-semibold text-brand-ink">[TODO: {children}]</mark>;
}

export function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[18px] font-bold text-brand-ink">{titel}</h2>
      <div className="flex flex-col gap-2 text-[14px] leading-relaxed text-brand-ink [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}

export function RechtsSeite({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg px-4 py-8">
      <article className="mx-auto flex max-w-[820px] flex-col gap-6 rounded-[var(--radius-l)] border border-brand-line bg-white p-5 shadow-[var(--shadow)] sm:p-8">
        <Link href="/dashboard" className="w-fit">
          <Image src="/tanzraum-logo-header.webp" alt="TanzRaum" width={1864} height={458} className="h-9 w-auto" />
        </Link>
        <h1 className="text-[28px] font-extrabold tracking-tight text-brand-ink">{titel}</h1>
        {children}
        <p className="text-[12.5px] text-brand-ink-soft">Stand: {STAND}</p>
        <RechtsLinks />
      </article>
    </div>
  );
}
