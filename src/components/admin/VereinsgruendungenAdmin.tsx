import Link from "next/link";
import { Building2 } from "lucide-react";
import type { AdminGruendung } from "@/app/dashboard/admin/vereine/actions";

const ANBIETER: Record<string, string> = { stripe: "Lastschrift (Stripe)", paypal: "PayPal", ueberweisung: "Überweisung" };
const STATUS: Record<AdminGruendung["status"], { text: string; farbe: string }> = {
  offen: { text: "wartet auf Zahlung", farbe: "bg-brand-gold-wash text-brand-ink" },
  abgeschlossen: { text: "Verein angelegt", farbe: "bg-brand-green-wash text-brand-green" },
  abgebrochen: { text: "zurückgenommen", farbe: "bg-brand-bg text-brand-ink-soft" },
};
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });

// Vereinsgruendungen durch Nutzer: Verein entsteht erst nach bestaetigter Zahlung (Ueberweisung: Rechnungen → Offene Ueberweisungen)
export function VereinsgruendungenAdmin({ gruendungen }: { gruendungen: AdminGruendung[] }) {
  if (gruendungen.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-l)] border border-brand-line bg-white p-4 shadow-[var(--shadow)] sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-brand-ink">
          <Building2 size={18} className="text-brand-gold" /> Vereinsgründungen
        </h2>
        <p className="text-[12.5px] text-brand-ink-soft">
          Nutzer gründen einen Verein mit dem Kauf der Vereinslizenz. Der Verein wird erst angelegt, wenn die Zahlung bestätigt ist – Überweisungen
          bestätigst du unter{" "}
          <Link href="/dashboard/admin/rechnungen" className="font-semibold text-brand-red">
            Rechnungen
          </Link>
          .
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-brand-line">
        {gruendungen.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
            <span className="min-w-0 font-semibold text-brand-ink [overflow-wrap:anywhere]">{g.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS[g.status].farbe}`}>{STATUS[g.status].text}</span>
            <span className="text-[12.5px] text-brand-ink-soft">
              {g.person ?? "Person"} · {g.anbieter ? (ANBIETER[g.anbieter] ?? g.anbieter) : "noch keine Zahlart"} · {datum(g.abgeschlossenAm ?? g.erstelltAm)}
            </span>
            {g.vereinId && (
              <Link href={`/dashboard/admin/tarife/verein/${g.vereinId}`} className="ml-auto text-[12.5px] font-semibold text-brand-red">
                Zum Verein →
              </Link>
            )}
            {g.hinweis && <p className="w-full text-[12.5px] font-semibold text-brand-red">{g.hinweis}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
