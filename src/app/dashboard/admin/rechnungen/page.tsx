import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { AufbewahrungSperre } from "@/components/admin/AufbewahrungSperre";

export const metadata = { title: "Rechnungen – TanzRaum-Administration" };

type Rechnung = {
  id: string;
  nummer: string;
  rechnungsdatum: string;
  empfaenger_name: string;
  leistung: string;
  betrag: number;
  zahlungsweg: string;
  versendet: boolean;
  aufbewahren_bis: string;
  anonymisierung_gesperrt: boolean;
  sperrgrund: string | null;
  anonymisiert_am: string | null;
};

const datum = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("de-DE");

export default async function RechnungenSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data } = await supabase
    .from("rechnungen")
    .select("id, nummer, rechnungsdatum, empfaenger_name, leistung, betrag, zahlungsweg, versendet, aufbewahren_bis, anonymisierung_gesperrt, sperrgrund, anonymisiert_am")
    .order("rechnungsdatum", { ascending: false })
    .order("nummer", { ascending: false })
    .limit(500);
  const liste = (data ?? []) as Rechnung[];

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <section className={KARTE}>
        <KarteKopf
          icon={Receipt}
          titel="Rechnungen"
          untertitel="Aufbewahrung 10 Jahre ab Ende des Rechnungsjahres (§ 147 AO), unverändert. Danach automatische Anonymisierung, außer die Aufbewahrung ist gesperrt."
        />
        <a
          href="/dashboard/admin/rechnungen/export"
          className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
        >
          <Download size={16} /> Alle Rechnungen als CSV
        </a>
        {liste.length === 0 ? (
          <p className="text-[13.5px] text-brand-ink-soft">Noch keine Rechnungen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="text-[12px] uppercase tracking-wide text-brand-ink-soft">
                <tr>
                  <th className="py-2 pr-3">Nummer</th>
                  <th className="py-2 pr-3">Datum</th>
                  <th className="py-2 pr-3">Empfänger</th>
                  <th className="py-2 pr-3">Leistung</th>
                  <th className="py-2 pr-3 text-right">Betrag</th>
                  <th className="py-2 pr-3">Aufbewahren bis</th>
                  <th className="py-2">Anonymisierung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {liste.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 font-semibold">{r.nummer}</td>
                    <td className="py-2 pr-3">{datum(r.rechnungsdatum)}</td>
                    <td className="py-2 pr-3">{r.empfaenger_name}</td>
                    <td className="py-2 pr-3">{r.leistung}</td>
                    <td className="py-2 pr-3 text-right">{Number(r.betrag).toFixed(2).replace(".", ",")} €</td>
                    <td className="py-2 pr-3">{datum(r.aufbewahren_bis)}</td>
                    <td className="py-2">
                      {r.anonymisiert_am ? (
                        <span className="text-brand-ink-soft">anonymisiert am {datum(r.anonymisiert_am)}</span>
                      ) : (
                        <AufbewahrungSperre id={r.id} gesperrt={r.anonymisierung_gesperrt} grund={r.sperrgrund} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
