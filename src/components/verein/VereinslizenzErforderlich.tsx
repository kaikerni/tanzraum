import Link from "next/link";
import { Building2, KeyRound, Clock } from "lucide-react";
import type { VereinsgruendungStatus } from "@/lib/tarife";

// „Verein gründen“ fuer FREE/BASIC: ein Verein entsteht in TanzRaum nur zusammen mit einer bezahlten Vereinslizenz.
// Die Datenbank laesst normale Nutzer keinen Verein anlegen (verein_anlegen) – hier steht nur der Weg dorthin.
export function VereinslizenzErforderlich({ gruendung }: { gruendung?: VereinsgruendungStatus | null }) {
  const bestellung = gruendung?.bestellung ?? null;
  const laeuft = bestellung?.zahlung?.laeuft === true;
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-brand-gold/50 bg-white p-5 shadow-[var(--shadow)]">
      <div className="flex items-center gap-2.5">
        <Building2 size={20} className="text-brand-gold" />
        <h2 className="text-[16px] font-bold text-brand-ink">Verein gründen</h2>
      </div>
      {laeuft && bestellung ? (
        <>
          <p className="flex w-fit items-center gap-1.5 rounded-full bg-brand-gold-wash px-3 py-1 text-[12.5px] font-bold text-brand-ink">
            <Clock size={14} /> Zahlung läuft
          </p>
          <p className="text-[13.5px] leading-snug text-brand-ink">
            Deine Vereinsgründung <strong>„{bestellung.name}“</strong> ist bestellt. Dein Verein wird angelegt, sobald die Zahlung bestätigt ist – du wirst
            dann automatisch Vereinsadmin.
          </p>
          <div>
            <Link href="/dashboard/tarif" className="btn-secondary inline-flex min-h-11 items-center gap-2">
              Zu „Mein Tarif“
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="flex w-fit items-center gap-1.5 rounded-full bg-brand-red-wash px-3 py-1 text-[12.5px] font-bold text-brand-red">
            <KeyRound size={14} /> Vereinslizenz erforderlich
          </p>
          <p className="text-[13.5px] leading-snug text-brand-ink">
            Um einen Verein in TanzRaum zu gründen und zu verwalten, benötigst du eine aktive Vereinslizenz.
          </p>
          <p className="text-[13px] leading-snug text-brand-ink-soft">
            Mit der Vereinslizenz verwaltest du deinen Verein und organisierst Mitglieder, Tanzgruppen, Trainings, Termine, TeamCloud und weitere
            Vereinsfunktionen zentral. Dein Verein wird angelegt, sobald die Zahlung bestätigt ist – du wirst automatisch Vereinsadmin.
          </p>
          <div>
            <Link href="/dashboard/tarif?wunsch=verein#verein" className="btn-primary inline-flex min-h-11 items-center gap-2">
              <KeyRound size={16} /> Vereinslizenz kaufen
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
