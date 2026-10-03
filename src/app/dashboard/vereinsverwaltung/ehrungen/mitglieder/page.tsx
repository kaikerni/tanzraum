import Link from "next/link";
import { KARTE } from "@/components/dashboard/Karten";
import { EhrungenKopf, EHRUNGEN_PFAD, KeinZugriff, mitVerein } from "@/components/ehrungen/EhrungenKopf";
import { ehrungsKontext } from "@/lib/ehrungen/kontext";
import { getVorgaenge, getZeitraeume } from "@/lib/ehrungen/daten";
import { getMitgliederListe } from "@/lib/mitglieder/getMitglieder";
import { datum } from "@/lib/ehrungen/typen";
import { rollenBezeichnung } from "@/lib/geschlecht";

export const metadata = { title: "Mitgliedszeiten – TanzRaum" };

export default async function EhrungenMitglieder({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const { verein: gewaehlt } = await searchParams;
  const { supabase, verein, vereine, ohneLizenz } = await ehrungsKontext(gewaehlt);
  if (!verein) return <KeinZugriff ohneLizenz={ohneLizenz} />;
  const [mitglieder, zeitraeume, vorgaenge] = await Promise.all([
    getMitgliederListe(supabase, verein.vereinId),
    getZeitraeume(supabase, verein.vereinId),
    getVorgaenge(supabase, verein.vereinId),
  ]);
  const ersteVon = (vmId: string, art: string) =>
    zeitraeume.filter((z) => z.vereinsMitgliedId === vmId && z.art === art).sort((a, b) => a.von.localeCompare(b.von))[0]?.von ?? null;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <EhrungenKopf verein={verein} vereine={vereine} aktiv="mitglieder" />
      <section className={KARTE}>
        <p className="mb-3 text-[13px] text-brand-ink-soft">
          „Mitglied seit“ und „aktiv tätig seit“ sind getrennte Angaben. Funktionen (z. B. Trainer, Vorstand) und mehrere Zeiträume mit Pausen können je Mitglied
          erfasst werden. Diese Zeiten sind die Grundlage für automatische Vorschläge.
        </p>
        <ul className="divide-y divide-brand-line overflow-hidden rounded-xl border border-brand-line">
          {(mitglieder ?? []).map((m) => {
            const anzahl = zeitraeume.filter((z) => z.vereinsMitgliedId === m.vmId).length;
            const verliehen = vorgaenge.filter((v) => v.vereinsMitgliedId === m.vmId && v.status === "verliehen").length;
            return (
              <li key={m.vmId}>
                <Link
                  href={mitVerein(`${EHRUNGEN_PFAD}/mitglied/${m.vmId}`, verein.vereinId)}
                  className="grid grid-cols-1 gap-1 px-3.5 py-3 hover:bg-brand-bg sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-[14px] font-semibold ${m.aktiv ? "text-brand-ink" : "text-brand-ink-faint"}`}>{m.name}</span>
                    <span className="text-[12px] text-brand-ink-soft">{rollenBezeichnung(m.rolle, m.geschlecht) ?? "–"}</span>
                  </span>
                  <span className="text-[12.5px] text-brand-ink-soft">Mitglied seit {datum(ersteVon(m.vmId, "mitgliedschaft"))}</span>
                  <span className="text-[12.5px] text-brand-ink-soft">aktiv seit {datum(ersteVon(m.vmId, "aktiv"))}</span>
                  <span className="text-[12.5px] text-brand-ink-soft">
                    {anzahl === 0 ? <span className="font-semibold text-[#8a5a00]">noch keine Zeiten</span> : `${anzahl} Zeitr${anzahl === 1 ? "aum" : "äume"}`}
                    {verliehen > 0 ? ` · ${verliehen} verliehen` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
