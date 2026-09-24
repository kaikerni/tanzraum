import Link from "next/link";
import {
  CalendarPlus,
  UserPlus,
  Mail,
  Upload,
  Trophy,
  Car,
  Music,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const AKTIONEN: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/training/neu", label: "Training anlegen", icon: CalendarPlus },
  { href: "/dashboard/mitglieder/neu", label: "Mitglied hinzufügen", icon: UserPlus },
  { href: "/dashboard/nachrichten/neu", label: "Nachricht schreiben", icon: Mail },
  { href: "/dashboard/dateien/hochladen", label: "Datei hochladen", icon: Upload },
  { href: "/dashboard/turniere/neu", label: "Turnier erfassen", icon: Trophy },
  { href: "/dashboard/fahrgemeinschaften/neu", label: "Fahrgemeinschaft erstellen", icon: Car },
  { href: "/dashboard/musik", label: "Musik verwalten", icon: Music },
  { href: "/dashboard/finanzen/neu", label: "Einnahme/Ausgabe erfassen", icon: Wallet },
];

export function QuickActions() {
  return (
    <div className="card">
      <h2 className="mb-3 font-display text-base font-bold text-brand-ink">Schnellaktionen</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {AKTIONEN.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-brand-line bg-white px-3 py-4 text-center transition-colors hover:border-brand-red hover:bg-brand-red-wash"
            >
              <Icon size={20} className="text-brand-red" strokeWidth={2} />
              <span className="text-[12.5px] font-medium leading-tight text-brand-ink">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
