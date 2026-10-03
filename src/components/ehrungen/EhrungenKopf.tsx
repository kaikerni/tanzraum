import Link from "next/link";
import type { VereinsMitgliedschaft } from "@/lib/dashboard/getDashboardData";

export const EHRUNGEN_PFAD = "/dashboard/vereinsverwaltung/ehrungen";

const REITER = [
  { key: "uebersicht", label: "🏅 Übersicht", href: "" },
  { key: "liste", label: "📋 Alle Ehrungen", href: "/liste" },
  { key: "bestellungen", label: "📦 Bestellungen", href: "/bestellungen" },
  { key: "jahr", label: "📅 Jahresübersicht", href: "/jahr" },
  { key: "mitglieder", label: "👥 Mitgliedszeiten", href: "/mitglieder" },
  { key: "auszeichnungen", label: "🏛️ Auszeichnungen", href: "/auszeichnungen" },
] as const;

export function mitVerein(pfad: string, vereinId: string) {
  return `${pfad}${pfad.includes("?") ? "&" : "?"}verein=${vereinId}`;
}

export function EhrungenKopf({
  verein,
  vereine,
  aktiv,
  titel = "Ehrungen & Orden",
  rechts,
}: {
  verein: VereinsMitgliedschaft;
  vereine: VereinsMitgliedschaft[];
  aktiv?: (typeof REITER)[number]["key"];
  titel?: string;
  rechts?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-medium text-brand-ink-soft">
            <Link href="/dashboard/vereinsverwaltung" className="hover:text-brand-red">
              Vereinsverwaltung
            </Link>{" "}
            ›{" "}
            <Link href={mitVerein(EHRUNGEN_PFAD, verein.vereinId)} className="hover:text-brand-red">
              Ehrungen & Orden
            </Link>
          </p>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">{titel}</h1>
          <p className="text-[14px] text-brand-ink-soft">{verein.vereinName} · nur für Vereinsadmins sichtbar</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rechts}
          {vereine.length > 1 &&
            vereine.map((v) => (
              <Link
                key={v.vereinId}
                href={mitVerein(EHRUNGEN_PFAD, v.vereinId)}
                aria-current={v.vereinId === verein.vereinId ? "page" : undefined}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                  v.vereinId === verein.vereinId ? "border-brand-red bg-brand-red text-white" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"
                }`}
              >
                {v.vereinName}
              </Link>
            ))}
        </div>
      </div>
      {aktiv && (
        <nav aria-label="Bereiche" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {REITER.map((r) => (
            <Link
              key={r.key}
              href={mitVerein(`${EHRUNGEN_PFAD}${r.href}`, verein.vereinId)}
              aria-current={r.key === aktiv ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold ${
                r.key === aktiv ? "bg-brand-navy text-white" : "bg-white text-brand-ink ring-1 ring-brand-line hover:bg-brand-bg"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

export function KeinZugriff({ ohneLizenz }: { ohneLizenz: boolean }) {
  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Ehrungen & Orden</h1>
      <p className="mt-2 rounded-[var(--radius-l)] border border-brand-line bg-white p-5 text-[14px] text-brand-ink-soft shadow-[var(--shadow)]">
        {ohneLizenz
          ? "Ehrungen & Orden ist Teil der Vereinslizenz. Sobald Ihr Verein die Vereinslizenz nutzt, finden Vereinsadmins das Modul hier."
          : "Dieser Bereich ist ausschließlich für Vereinsadmins zugänglich."}
      </p>
    </div>
  );
}
