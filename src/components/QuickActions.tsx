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
  Store,
  Flag,
  Megaphone,
  Building2,
  BarChart3,
  Eye,
  Receipt,
} from "lucide-react";
import { darf, modulAn, type Tarif, type VereinsModul, type Zugriff } from "@/lib/navigation";

type Aktion = {
  href: string;
  zeile1: string;
  zeile2: string;
  icon: LucideIcon;
  tarif: Tarif;
  // Liste = eines davon reicht. "plattform_admin" = nur Plattform-Admin (Turniere legt laut RLS nur er an).
  rechte?: string[];
  iconKlasse?: string;
  modul?: VereinsModul;
};

const AKTIONEN: Aktion[] = [
  { href: "/dashboard/training/neu", zeile1: "Training", zeile2: "anlegen", icon: Plus, tarif: "verein", rechte: ["rolle_admin", "rolle_trainer"], modul: "training" },
  { href: "/dashboard/mitglieder/neu", zeile1: "Mitglied", zeile2: "hinzufügen", icon: UserPlus, tarif: "verein", rechte: ["rolle_admin"] },
  { href: "/dashboard/nachrichten/neu", zeile1: "Nachricht", zeile2: "schreiben", icon: Mail, tarif: "free" },
  { href: "/dashboard/boerse/neu", zeile1: "Börse", zeile2: "Angebot einstellen", icon: Store, tarif: "free", iconKlasse: "text-brand-gold" },
  { href: "/dashboard/dateien#hochladen", zeile1: "Datei", zeile2: "hochladen", icon: Upload, tarif: "basic", modul: "dateien" },
  { href: "/dashboard/turniere/neu", zeile1: "Turnier", zeile2: "erfassen", icon: Trophy, tarif: "verein", rechte: ["plattform_admin"], iconKlasse: "text-brand-gold", modul: "turniere" },
  { href: "/dashboard/fahrgemeinschaften/neu", zeile1: "Fahrgemeinschaft", zeile2: "erstellen", icon: Car, tarif: "verein", rechte: ["fahrgemeinschaften"], modul: "fahrgemeinschaften" },
  { href: "/dashboard/musik", zeile1: "Musik", zeile2: "verwalten", icon: Music, tarif: "verein", rechte: ["rolle_admin", "rolle_trainer"], modul: "musik" },
  { href: "/dashboard/finanzen?tab=kassenbuch", zeile1: "Einnahme/Ausgabe", zeile2: "erfassen", icon: Coins, tarif: "verein", rechte: ["beitraege"], modul: "finanzen" },
  { href: "/dashboard/verein/bearbeiten", zeile1: "Vereinsdaten", zeile2: "bearbeiten", icon: Settings, tarif: "verein", rechte: ["rolle_admin"] },
];

// TanzRaum-Administration: nur Plattform-Aufgaben
const ADMIN_AKTIONEN: Aktion[] = [
  { href: "/dashboard/admin/meldungen", zeile1: "Meldungen", zeile2: "prüfen", icon: Flag, tarif: "free", iconKlasse: "text-brand-red" },
  { href: "/dashboard/admin/ankuendigungen", zeile1: "Ankündigung", zeile2: "schreiben", icon: Megaphone, tarif: "free" },
  { href: "/dashboard/turniere/neu", zeile1: "Turnier", zeile2: "erfassen", icon: Trophy, tarif: "free", iconKlasse: "text-brand-gold" },
  { href: "/dashboard/admin/vereine", zeile1: "Vereine", zeile2: "ansehen", icon: Building2, tarif: "free" },
  { href: "/dashboard/admin/statistik", zeile1: "Plattform-", zeile2: "Statistik", icon: BarChart3, tarif: "free" },
  { href: "/dashboard/admin/boerse", zeile1: "Börse", zeile2: "moderieren", icon: Store, tarif: "free", iconKlasse: "text-brand-gold" },
  { href: "/dashboard/admin/rechnungen", zeile1: "Rechnungen", zeile2: "ansehen", icon: Receipt, tarif: "free" },
  { href: "/dashboard/nachrichten/neu", zeile1: "Nachricht", zeile2: "schreiben", icon: Mail, tarif: "free" },
  { href: "/dashboard/admin/vorschau", zeile1: "Ansicht als …", zeile2: "Tarife & Rollen", icon: Eye, tarif: "free" },
];

export function QuickActions({ zugriff, breit = false }: { zugriff: Zugriff; breit?: boolean }) {
  const sichtbar = zugriff.istPlattformAdmin ? ADMIN_AKTIONEN : AKTIONEN.filter((a) =>
    !modulAn(zugriff, a.modul) || (a.modul === "musik" && zugriff.musikAn === false) ? false : a.rechte === undefined ? darf(zugriff, a.tarif) : a.rechte.some((r) => darf(zugriff, a.tarif, r)),
  );
  if (sichtbar.length === 0) return null;

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)]">
      <div className="mb-3 flex items-center gap-2.5">
        <Zap size={20} strokeWidth={1.9} className="text-brand-ink" />
        <h2 className="text-[15.5px] font-bold text-brand-ink">Schnellaktionen</h2>
      </div>
      <div className={`grid flex-1 grid-cols-3 gap-2 ${breit ? "sm:grid-cols-5 xl:grid-cols-9" : ""}`}>
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
