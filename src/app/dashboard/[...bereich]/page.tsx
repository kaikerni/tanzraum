import Link from "next/link";
import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { NAV } from "@/lib/navigation";
import { KARTE } from "@/components/dashboard/Karten";

// Menuepunkte, deren Modul noch nicht fertig ist, zeigen statt einer Fehlerseite einen Hinweis.
const BESCHREIBUNG: Record<string, string> = {
  "/dashboard/trainingsplan": "Trainingsinhalte planen, Übungen sammeln und Einheiten für die Gruppen vorbereiten.",
  "/dashboard/mitgliedsantraege": "Online-Mitgliedsanträge mit Daten, SEPA-Mandat und Einwilligungen prüfen und annehmen.",
  "/dashboard/dateien": "Dokumente, Satzung, Pläne und Fotos zentral im Verein ablegen.",
  "/dashboard/fahrgemeinschaften": "Fahrten zu Turnieren und Auftritten organisieren – wer fährt, wer hat noch Platz.",
  "/dashboard/musik": "Musikstücke und Schnitte für Tänze verwalten und mit der Gruppe teilen.",
  "/dashboard/kostueme": "Kostüme, Größen, Ausgaben und Material im Blick behalten.",
  "/dashboard/finanzen": "Beiträge, Kassenbuch und Zahlungen des Vereins.",
  "/dashboard/statistiken": "Auswertungen zu Mitgliedern, Trainingsbeteiligung und Turnieren.",
  "/dashboard/vereinsverwaltung": "Rechte, Rollen, Lizenz und Einstellungen des Vereins.",
  "/dashboard/admin": "Verwaltung der Plattform: Vereine, Personen, Turnierkalender und Support.",
};

export default async function BereichInArbeit({ params }: { params: Promise<{ bereich: string[] }> }) {
  const { bereich } = await params;
  const pfad = `/dashboard/${bereich.join("/")}`;
  const eintrag = NAV.find((n) => n.href === pfad);
  if (!eintrag) notFound();
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
