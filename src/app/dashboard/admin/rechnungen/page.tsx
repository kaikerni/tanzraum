import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt, Download, FileStack } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { RechnungenListe, type RechnungZeile } from "@/components/admin/RechnungenListe";

export const metadata = { title: "Rechnungen – TanzRaum-Administration" };

const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

// Rechnungen der zahlenden Kundinnen und Kunden: Liste, Vorschau (PDF), Download einzeln/alle, erneuter Versand
export default async function RechnungenSeite({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const { jahr: jahrParam } = await searchParams;
  const jahr = /^\d{4}$/.test(jahrParam ?? "") ? Number(jahrParam) : null;

  let q = supabase
    .from("rechnungen")
    .select(
      "id, nummer, rechnungsdatum, empfaenger_name, empfaenger_email, leistung, betrag, zahlungsweg, versendet, versendet_am, aufbewahren_bis, anonymisierung_gesperrt, sperrgrund, anonymisiert_am",
    )
    .order("rechnungsdatum", { ascending: false })
    .order("nummer", { ascending: false })
    .limit(500);
  if (jahr) q = q.gte("rechnungsdatum", `${jahr}-01-01`).lte("rechnungsdatum", `${jahr}-12-31`);
  const [{ data }, { data: jahreDaten }] = await Promise.all([q, supabase.from("rechnungen").select("rechnungsdatum").order("rechnungsdatum")]);
  const liste = (data ?? []) as RechnungZeile[];
  const jahre = [...new Set((jahreDaten ?? []).map((r: { rechnungsdatum: string }) => Number(r.rechnungsdatum.slice(0, 4))))].sort((a, b) => b - a);
  const summe = liste.reduce((s, r) => s + Number(r.betrag), 0);
  const alleHref = `/dashboard/admin/rechnungen/pdf?alle=1${jahr ? `&jahr=${jahr}` : ""}&download=1`;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <section className={KARTE}>
        <KarteKopf
          icon={Receipt}
          titel="Rechnungen"
          untertitel="Alle Rechnungen der zahlenden Kundinnen und Kunden. Nummern fortlaufend je Jahr (TR-Jahr-0001). Zeile anklicken für die Vorschau. Aufbewahrung 10 Jahre ab Ende des Rechnungsjahres (§ 147 AO), unverändert."
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1.5" aria-label="Rechnungsjahr">
            {[null, ...jahre].map((j) => (
              <Link
                key={j ?? "alle"}
                href={j ? `/dashboard/admin/rechnungen?jahr=${j}` : "/dashboard/admin/rechnungen"}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
                  j === jahr ? "border-brand-ink bg-brand-ink text-white" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"
                }`}
              >
                {j ?? "Alle Jahre"}
              </Link>
            ))}
          </nav>
          <span className="ml-auto text-[13px] text-brand-ink-soft">
            {liste.length} {liste.length === 1 ? "Rechnung" : "Rechnungen"} · <strong className="text-brand-ink">{euro(summe)}</strong>
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {liste.length > 0 && (
            <a
              href={alleHref}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
            >
              <FileStack size={16} /> {jahr ? `Alle Rechnungen ${jahr} als PDF` : "Alle Rechnungen als PDF"}
            </a>
          )}
          <a
            href="/dashboard/admin/rechnungen/export"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            <Download size={16} /> Liste als CSV
          </a>
        </div>

        {liste.length === 0 ? <p className="text-[13.5px] text-brand-ink-soft">Noch keine Rechnungen.</p> : <RechnungenListe liste={liste} />}
      </section>
    </div>
  );
}
