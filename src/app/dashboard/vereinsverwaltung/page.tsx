import Link from "next/link";
import { Medal, Users, Settings, ChevronRight, Hammer } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { KeinZugriff, EHRUNGEN_PFAD, mitVerein } from "@/components/ehrungen/EhrungenKopf";

export const metadata = { title: "Vereinsverwaltung – TanzRaum" };

// Einstieg fuer Vereinsadmins. Weitere Bereiche (Rechte, Rollen, Lizenz) folgen.
export default async function Vereinsverwaltung({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const { verein: gewaehlt } = await searchParams;
  const { verein, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const kacheln = [
    {
      href: mitVerein(EHRUNGEN_PFAD, verein.vereinId),
      icon: Medal,
      titel: "🏅 Ehrungen & Orden",
      text: "Mögliche Ehrungen erkennen, vormerken, bestellen, verleihen und die Ehrungshistorie führen.",
    },
    { href: `/dashboard/mitglieder?verein=${verein.vereinId}`, icon: Users, titel: "Mitglieder", text: "Mitglieder, Rollen, Gruppen und Familien verwalten." },
    { href: "/dashboard/verein/bearbeiten", icon: Settings, titel: "Vereinsdaten", text: "Name, Adresse, Logo und Beschreibung des Vereins." },
  ];
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Vereinsverwaltung</h1>
        <p className="text-[14px] text-brand-ink-soft">{verein.vereinName} · nur für Vereinsadmins</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {kacheln.map((k) => (
          <Link key={k.titel} href={k.href} className={`${KARTE} flex items-start gap-3 hover:border-brand-red/40`}>
            <k.icon size={22} className="mt-0.5 shrink-0 text-brand-gold" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-bold text-brand-ink">{k.titel}</span>
              <span className="block text-[13px] text-brand-ink-soft">{k.text}</span>
            </span>
            <ChevronRight size={18} className="mt-1 shrink-0 text-brand-ink-faint" />
          </Link>
        ))}
      </div>
      <p className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-ink-faint">
        <Hammer size={13} /> Rechte & Rollen, Lizenz und weitere Einstellungen folgen in einem der nächsten Updates.
      </p>
    </div>
  );
}
