import Link from "next/link";
import { CreditCard } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";

export type TarifZaehlerDaten = { free: number; basic: number; verein: number; vereine_mit_lizenz: number; basic_pausiert: number };

// Zaehler fuer die TanzRaum-Administration: Klick fuehrt zur jeweiligen Liste
export function TarifZaehler({ z, aktiv }: { z: TarifZaehlerDaten; aktiv?: string }) {
  const kachel = (stufe: string) =>
    `flex flex-col gap-0.5 rounded-xl border p-3 transition-colors hover:border-brand-red ${aktiv === stufe ? "border-brand-red bg-brand-red-wash" : "border-brand-line bg-white"}`;
  return (
    <section className={`${KARTE} flex flex-col gap-3`} aria-label="Tarife">
      <h2 className="flex items-center gap-2 text-[16px] font-bold text-brand-ink">
        <CreditCard size={18} className="text-brand-red" /> Mitglieder nach Tarif
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Link href="/dashboard/admin/tarife?stufe=free" className={kachel("free")}>
          <span className="text-[12px] font-bold tracking-wide text-brand-ink-soft">FREE</span>
          <span className="text-[26px] font-extrabold leading-none text-brand-ink">{z.free}</span>
        </Link>
        <Link href="/dashboard/admin/tarife?stufe=basic" className={kachel("basic")}>
          <span className="text-[12px] font-bold tracking-wide text-brand-ink-soft">BASIC</span>
          <span className="text-[26px] font-extrabold leading-none text-brand-ink">{z.basic}</span>
          {z.basic_pausiert > 0 && <span className="text-[11.5px] text-brand-ink-soft">{z.basic_pausiert} weitere pausiert (Verein)</span>}
        </Link>
        <Link href="/dashboard/admin/tarife?stufe=verein" className={kachel("verein")}>
          <span className="text-[12px] font-bold tracking-wide text-brand-ink-soft">VEREIN</span>
          <span className="text-[26px] font-extrabold leading-none text-brand-ink">{z.verein}</span>
          <span className="text-[11.5px] text-brand-ink-soft">{z.vereine_mit_lizenz} Vereine mit Lizenz</span>
        </Link>
      </div>
    </section>
  );
}
