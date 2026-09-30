import { Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { datumDe, euro, heuteBerlin } from "@/lib/finanzen";

type Zeile = { id: string; verein_name: string; person: string; art: string; betrag: number; faellig: string | null; bezahlt: boolean; bezahlt_am: string | null };

// Eigene Beitraege bzw. die der Kinder (DB: meine_beitraege) – erscheint nur, wenn es welche gibt
export async function MeineBeitraege() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("meine_beitraege");
  const liste = (data ?? []) as Zeile[];
  if (liste.length === 0) return null;
  const heute = heuteBerlin();
  const mehrerePersonen = new Set(liste.map((z) => z.person)).size > 1;
  return (
    <section id="beitraege" className={KARTE}>
      <KarteKopf icon={Receipt} titel="Meine Beiträge" untertitel="Vom Verein erfasst – bezahlt wird wie gewohnt beim Verein (z. B. Überweisung oder Lastschrift)." />
      <ul className="flex flex-col divide-y divide-brand-line">
        {liste.map((z) => {
          const ueber = !z.bezahlt && !!z.faellig && z.faellig < heute;
          return (
            <li key={z.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
              <span className="min-w-0 flex-1">
                <strong className="text-brand-ink">{z.art}</strong>
                <span className="text-brand-ink-soft">
                  {" "}
                  · {z.verein_name}
                  {mehrerePersonen ? ` · ${z.person}` : ""} · fällig {datumDe(z.faellig)}
                </span>
              </span>
              <span className="font-bold text-brand-ink">{euro(Number(z.betrag))}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${z.bezahlt ? "bg-brand-green-wash text-brand-green" : ueber ? "bg-brand-red-wash text-brand-red" : "bg-brand-gold-wash text-brand-gold"}`}
              >
                {z.bezahlt ? `bezahlt ${datumDe(z.bezahlt_am)}` : ueber ? "überfällig" : "offen"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
