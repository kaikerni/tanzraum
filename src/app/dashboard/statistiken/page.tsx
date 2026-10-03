import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BarChart3, Settings2, Trophy, Users, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getVereinStatistik } from "@/lib/verein/statistik";
import { monatKurz } from "@/lib/admin/zugang";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { Balken, Donut, Kennzahl, Linie } from "@/components/admin/Diagramme";

export const metadata = { title: "Statistiken – TanzRaum" };

const FARBEN = ["#e11d2e", "#c9921f", "#1f6feb", "#1f9d55", "#5b3fd1", "#f2a93b", "#98a0b0"];

// Vereinsstatistik: nur Zahlen, Inhalte und Zugriff legt der Vereinsadmin fest (DB: verein_statistik)
export default async function StatistikenSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/statistiken");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  const { verein: gewaehlt } = await searchParams;
  const vereine = daten.vereine.filter((v) => v.vereinTarif === "verein" && !v.vereinGesperrt);
  const verein = vereine.find((v) => v.vereinId === gewaehlt) ?? vereine[0];
  if (!verein) {
    return (
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Statistiken</h1>
        <p className="mt-2 text-[14px] text-brand-ink-soft">Statistiken gibt es für Vereine mit Verein-Lizenz.</p>
      </div>
    );
  }
  const { daten: s, fehler } = await getVereinStatistik(supabase, verein.vereinId);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
            <BarChart3 size={24} className="text-brand-red" /> Statistiken
          </h1>
          <p className="text-[14px] text-brand-ink-soft">{verein.vereinName} · zusammengefasste Zahlen, keine persönlichen Daten</p>
        </div>
        {verein.istAdmin && (
          <Link
            href={`/dashboard/vereinsverwaltung/bereiche?verein=${verein.vereinId}#statistik`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            <Settings2 size={16} /> Inhalte &amp; Zugriff anpassen
          </Link>
        )}
      </div>

      {fehler || !s ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>{fehler ?? "Keine Daten."}</p>
      ) : s.inhalte.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>Der Vereinsadmin hat noch keine Inhalte für die Statistik ausgewählt.</p>
      ) : (
        <>
          {(s.mitglieder || s.turniere) && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {s.mitglieder && <Kennzahl label="Aktive Mitglieder" wert={s.mitglieder.aktiv} farbe="text-brand-green" />}
              {s.mitglieder && <Kennzahl label="Neu, Antrag offen" wert={s.mitglieder.neu} farbe="text-brand-gold" />}
              {s.turniere && <Kennzahl label="Turnierstarts" wert={s.turniere.starts} zusatz="in diesem Jahr" />}
              {s.turniere && <Kennzahl label="Podestplätze" wert={s.turniere.podest} zusatz="Platz 1–3" farbe="text-brand-gold" />}
              {s.turniere && <Kennzahl label="Siege" wert={s.turniere.siege} farbe="text-brand-red" />}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {s.mitglieder && (
              <section className={KARTE}>
                <KarteKopf icon={Users} titel="Mitgliederentwicklung (12 Monate)" />
                <Linie werte={s.mitglieder.verlauf.map((v) => ({ label: monatKurz(v.monat), wert: Number(v.gesamt) }))} farbe="#1f9d55" />
              </section>
            )}
            {s.beteiligung && (
              <section className={KARTE}>
                <KarteKopf icon={Activity} titel="Trainingsbeteiligung in % (12 Monate)" />
                <Balken werte={s.beteiligung.map((b) => ({ label: monatKurz(b.monat), wert: Number(b.prozent ?? 0) }))} farbe="#1f6feb" />
              </section>
            )}
            {s.rollen && s.rollen.length > 0 && (
              <section className={KARTE}>
                <KarteKopf icon={UsersRound} titel="Mitglieder nach Rolle" />
                <Donut
                  mitte={String(s.rollen.reduce((a, r) => a + Number(r.anzahl), 0))}
                  untertitel="Mitglieder"
                  segmente={s.rollen.map((r, i) => ({ label: r.rolle, wert: Number(r.anzahl), farbe: FARBEN[i % FARBEN.length] }))}
                />
              </section>
            )}
            {s.altersklassen && s.altersklassen.length > 0 && (
              <section className={KARTE}>
                <KarteKopf icon={Users} titel="Altersklassen" />
                <Donut
                  mitte={String(s.altersklassen.reduce((a, r) => a + Number(r.anzahl), 0))}
                  untertitel="Mitglieder"
                  segmente={s.altersklassen.map((r, i) => ({ label: r.altersklasse, wert: Number(r.anzahl), farbe: FARBEN[i % FARBEN.length] }))}
                />
              </section>
            )}
            {s.gruppen && (
              <section className={KARTE}>
                <KarteKopf icon={Trophy} titel="Tanzgruppen" />
                {s.gruppen.length === 0 ? (
                  <p className="text-[13px] text-brand-ink-soft">Noch keine Gruppen.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-[13.5px]">
                    {s.gruppen.map((g) => {
                      const max = Math.max(1, ...s.gruppen!.map((x) => Number(x.anzahl)));
                      return (
                        <li key={g.gruppe} className="grid grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-3">
                          <span className="truncate text-brand-ink">{g.gruppe}</span>
                          <span className="h-2.5 overflow-hidden rounded-full bg-brand-bg">
                            <span className="block h-full rounded-full bg-brand-red" style={{ width: `${(Number(g.anzahl) / max) * 100}%` }} />
                          </span>
                          <span className="tabular-nums font-semibold text-brand-ink">{g.anzahl}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
