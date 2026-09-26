import Link from "next/link";
import {
  Plus,
  UserPlus,
  Mail,
  Upload,
  Trophy,
  Car,
  Music,
  Coins,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { darf, type Tarif, type Zugriff } from "@/lib/navigation";

type Aktion = {
  href: string;
  zeile1: string;
  zeile2: string;
  icon: LucideIcon;
  tarif: Tarif;
  // Liste = eines davon reicht. "plattform_admin" = nur Plattform-Admin (Turniere legt laut RLS nur er an).
  rechte?: string[];
  iconKlasse?: string;
};

const AKTIONEN: Aktion[] = [
  { href: "/dashboard/training/neu", zeile1: "Training", zeile2: "anlegen", icon: Plus, tarif: "verein", rechte: ["rolle_admin", "rolle_trainer"] },
  { href: "/dashboard/mitglieder/neu", zeile1: "Mitglied", zeile2: "hinzufügen", icon: UserPlus, tarif: "verein", rechte: ["rolle_admin"] },
  { href: "/dashboard/nachrichten/neu", zeile1: "Nachricht", zeile2: "schreiben", icon: Mail, tarif: "free" },
  { href: "/dashboard/dateien/hochladen", zeile1: "Datei", zeile2: "hochladen", icon: Upload, tarif: "basic" },
  { href: "/dashboard/turniere/neu", zeile1: "Turnier", zeile2: "erfassen", icon: Trophy, tarif: "verein", rechte: ["plattform_admin"], iconKlasse: "text-brand-gold" },
  { href: "/dashboard/fahrgemeinschaften/neu", zeile1: "Fahrgemeinschaft", zeile2: "erstellen", icon: Car, tarif: "basic" },
  { href: "/dashboard/musik", zeile1: "Musik", zeile2: "verwalten", icon: Music, tarif: "verein", rechte: ["rolle_admin", "rolle_trainer"] },
  { href: "/dashboard/finanzen/neu", zeile1: "Einnahme/Ausgabe", zeile2: "erfassen", icon: Coins, tarif: "verein", rechte: ["beitraege"] },
  { href: "/dashboard/verein/bearbeiten", zeile1: "Vereinsdaten", zeile2: "bearbeiten", icon: Settings, tarif: "verein", rechte: ["rolle_admin"] },
];

export function QuickActions({ zugriff }: { zugriff: Zugriff }) {
  const sichtbar = AKTIONEN.filter((a) =>
    a.rechte === undefined ? darf(zugriff, a.tarif) : a.rechte.some((r) => darf(zugriff, a.tarif, r)),
  );
  if (sichtbar.length === 0) return null;

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-center gap-2.5">
        <Zap size={20} strokeWidth={1.9} className="text-brand-ink" />
        <h2 className="text-[15.5px] font-bold text-brand-ink">Schnellaktionen</h2>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-2">
        {sichtbar.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-brand-line bg-white px-1.5 py-2.5 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-red hover:shadow-[var(--shadow-hover)]"
            >
              <Icon
                size={21}
                strokeWidth={1.9}
                className={`transition-colors group-hover:text-brand-red ${a.iconKlasse ?? "text-brand-ink"}`}
              />
              <span className="text-[12px] leading-tight">
                <span className="block font-medium text-brand-ink">{a.zeile1}</span>
                <span className="block text-brand-ink-soft">{a.zeile2}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
