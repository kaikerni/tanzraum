import Link from "next/link";
import { ArrowLeft, Eye, Gavel } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { DashboardAnsicht } from "@/components/dashboard/DashboardAnsicht";
import { sichtbareNav } from "@/lib/navigation";
import { adminSitzung } from "@/lib/admin/zugang";
import { JURY_BEISPIEL, VORSCHAU_LABEL, vorschau, type VorschauAnsicht } from "@/lib/admin/vorschauDaten";

export const metadata = { title: "Oberflächen-Vorschau – TanzRaum-Administration" };

const ANSICHTEN = Object.keys(VORSCHAU_LABEL) as VorschauAnsicht[];

// So sieht TanzRaum je nach Tarif bzw. Rolle aus – ausschliesslich mit erfundenen Beispieldaten
export default async function VorschauSeite({ searchParams }: { searchParams: Promise<{ ansicht?: string }> }) {
  await adminSitzung("/dashboard/admin/vorschau");
  const { ansicht: roh } = await searchParams;
  const ansicht: VorschauAnsicht = ANSICHTEN.includes(roh as VorschauAnsicht) ? (roh as VorschauAnsicht) : "free";
  const v = ansicht === "juryraum" ? null : vorschau(ansicht);

  return (
    <div className="mx-auto flex max-w-[1560px] flex-col gap-4">
      <div>
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> Administration
        </Link>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Eye size={24} className="text-brand-red" /> Oberflächen-Vorschau
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">Beispieldaten – keine echten Personen oder Vereine.</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Ansicht wählen">
        {ANSICHTEN.map((a) => (
          <Link
            key={a}
            href={`/dashboard/admin/vorschau?ansicht=${a}`}
            aria-current={a === ansicht ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold tracking-wide ${a === ansicht ? "bg-brand-red text-white" : "border border-brand-line bg-white text-brand-ink hover:bg-brand-bg"}`}
          >
            {VORSCHAU_LABEL[a]}
          </Link>
        ))}
      </nav>

      <div className="rounded-[var(--radius-l)] border-2 border-dashed border-brand-gold/60 bg-brand-bg p-3 sm:p-4">
        <p className="mb-3 inline-flex rounded-full bg-brand-gold-wash px-3 py-1 text-[12px] font-semibold text-brand-gold">
          Vorschau „{VORSCHAU_LABEL[ansicht]}“ · Beispieldaten · nicht klickbar
        </p>
        {v ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_1fr]">
            <aside className={`${KARTE} h-fit`}>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-brand-ink-faint">Menü</p>
              <ul className="flex flex-col gap-1 text-[13px] text-brand-ink">
                {sichtbareNav(v.zugriff).map((n) => (
                  <li key={n.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                    <n.icon size={15} className="text-brand-ink-soft" /> {n.label}
                  </li>
                ))}
              </ul>
            </aside>
            <div className="pointer-events-none select-none" aria-hidden="true">
              <DashboardAnsicht {...v.props} />
            </div>
          </div>
        ) : (
          <section className={`${KARTE} flex flex-col gap-3`}>
            <h2 className="flex items-center gap-2 text-[18px] font-bold text-brand-ink">
              <Gavel size={18} className="text-brand-gold" /> JuryRaum – Meine Einsätze
            </h2>
            <ul className="divide-y divide-brand-line">
              {JURY_BEISPIEL.map((j) => (
                <li key={j.turnier} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13.5px]">
                  <span>
                    <strong className="text-brand-ink">{j.turnier}</strong>
                    <span className="text-brand-ink-soft">
                      {" "}
                      · {j.ort} · {new Date(j.datum).toLocaleDateString("de-DE")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-brand-ink-soft">{j.rolle}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${j.status === "zugesagt" ? "bg-brand-green-wash text-brand-green" : j.status === "angefragt" ? "bg-brand-gold-wash text-brand-gold" : "bg-brand-bg text-brand-ink-soft"}`}
                    >
                      {j.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
