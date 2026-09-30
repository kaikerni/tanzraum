import Link from "next/link";
import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { NAV } from "@/lib/navigation";
import { KARTE } from "@/components/dashboard/Karten";
import { ModulAusHinweis, modulAusgeschaltet } from "@/components/verein/ModulSchutz";

// Menuepunkte, deren Modul noch nicht fertig ist, zeigen statt einer Fehlerseite einen Hinweis.
const BESCHREIBUNG: Record<string, string> = {
  "/dashboard/musik": "Musikstücke und Schnitte für Tänze verwalten und mit der Gruppe teilen.",
  "/dashboard/finanzen": "Beiträge, Kassenbuch und Zahlungen des Vereins.",
  "/dashboard/vereinsverwaltung": "Rechte, Rollen, Lizenz und Einstellungen des Vereins.",
  "/dashboard/admin": "Verwaltung der Plattform: Vereine, Personen, Turnierkalender und Support.",
};

export default async function BereichInArbeit({ params }: { params: Promise<{ bereich: string[] }> }) {
  const { bereich } = await params;
  const pfad = `/dashboard/${bereich.join("/")}`;
  const eintrag = NAV.find((n) => n.href === pfad);
  if (!eintrag) notFound();
  if (eintrag.modul && (await modulAusgeschaltet(eintrag.modul))) return <ModulAusHinweis modul={eintrag.modul} />;
  const Icon = eintrag.icon;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">{eintrag.label}</h1>
      <section className={`${KARTE} flex flex-col items-center gap-3 py-10 text-center`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold-wash text-brand-gold">
          <Icon size={26} />
        </div>
        <p className="text-[16px] font-bold text-brand-ink">Dieser Bereich ist in Arbeit</p>
        {BESCHREIBUNG[pfad] && <p className="max-w-md text-[14px] text-brand-ink-soft">{BESCHREIBUNG[pfad]}</p>}
        <p className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-ink-faint">
          <Hammer size={13} /> Kommt in einem der nächsten Updates.
        </p>
        <Link href="/dashboard" className="mt-2 text-[13.5px] font-semibold text-brand-red">
          Zurück zum Dashboard
        </Link>
      </section>
    </div>
  );
}
