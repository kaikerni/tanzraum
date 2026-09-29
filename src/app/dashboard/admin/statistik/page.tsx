import Link from "next/link";
import { ArrowLeft, BarChart3, Building2, MessageSquare, Radio, TrendingUp, Users } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { Balken, Donut, Kennzahl, Linie } from "@/components/admin/Diagramme";
import { adminSitzung, monatKurz, type PlattformStatistik } from "@/lib/admin/zugang";

export const metadata = { title: "Plattform-Statistik – TanzRaum-Administration" };

// Aggregierte Plattformzahlen – serverseitig berechnet (admin_plattform_statistik), ohne Namen oder Personendaten
export default async function StatistikSeite() {
  const { supabase } = await adminSitzung("/dashboard/admin/statistik");
  const { data } = await supabase.rpc("admin_plattform_statistik");
  const s = data as PlattformStatistik | null;
  if (!s) {
    return <p className="mx-auto max-w-[900px] text-[14px] text-brand-ink-soft">Die Statistik konnte nicht geladen werden.</p>;
  }
  const registrierungen = s.registrierungen ?? [];
  const vereine = s.vereine_verlauf ?? [];
  const nachrichten = s.nachrichten_wochen ?? [];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div>
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> Administration
        </Link>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <BarChart3 size={24} className="text-brand-red" /> Plattform-Statistik
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">Nur zusammengefasste Zahlen – keine Namen, keine Mitgliederdaten.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kennzahl label="Nutzer gesamt" wert={s.nutzer_gesamt} zusatz={`+${s.neu_30_tage} in 30 Tagen`} />
        <Kennzahl label="Gerade online" wert={s.online_jetzt} zusatz={`${s.aktiv_24h} aktiv in 24 h`} farbe="text-brand-green" />
        <Kennzahl label="Neu diese Woche" wert={s.neu_7_tage} zusatz="Registrierungen" farbe="text-brand-blue" />
        <Kennzahl label="Vereine" wert={s.vereine_gesamt} zusatz={`${s.lizenzen_aktiv} mit aktiver Lizenz`} farbe="text-brand-gold" />
        <Kennzahl label="Tanzgruppen" wert={s.gruppen_gesamt} />
        <Kennzahl label="Nachrichten" wert={s.nachrichten_30_tage} zusatz="in 30 Tagen" farbe="text-brand-purple" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={KARTE}>
          <KarteKopf icon={Users} titel="Nutzer nach Tarif" />
          <Donut
            mitte={String(s.nutzer_gesamt)}
            untertitel="Nutzer"
            segmente={[
              { label: "FREE", wert: s.free, farbe: "#98a0b0" },
              { label: "BASIC", wert: s.basic, farbe: "#1f6feb" },
              { label: "über Verein-Lizenz", wert: s.verein_zugang, farbe: "#c9921f" },
            ]}
          />
        </section>
        <section className={KARTE}>
          <KarteKopf icon={Building2} titel="Vereinszuordnung" />
          <Donut
            mitte={String(s.mit_zuordnung)}
            untertitel="zugeordnet"
            segmente={[
              { label: "offiziell im Verein (Lizenz)", wert: s.mit_zuordnung, farbe: "#1f9d55" },
              { label: "ohne Vereinszuordnung", wert: s.ohne_zuordnung, farbe: "#e8eaf0" },
            ]}
          />
        </section>
        <section className={KARTE}>
          <KarteKopf icon={TrendingUp} titel="Nutzer – Entwicklung (12 Monate)" />
          <Linie werte={registrierungen.map((r) => ({ label: monatKurz(r.monat), wert: Number(r.gesamt) }))} farbe="#1f6feb" />
        </section>
        <section className={KARTE}>
          <KarteKopf icon={Users} titel="Neue Registrierungen pro Monat" />
          <Balken werte={registrierungen.map((r) => ({ label: monatKurz(r.monat), wert: Number(r.neu) }))} farbe="#e11d2e" />
        </section>
        <section className={KARTE}>
          <KarteKopf icon={Building2} titel="Vereine & Lizenzen" />
          <Donut
            mitte={String(s.vereine_gesamt)}
            untertitel="Vereine"
            segmente={[
              { label: "Lizenz aktiv", wert: s.lizenzen_aktiv, farbe: "#c9921f" },
              { label: "ohne aktive Lizenz", wert: s.lizenzen_inaktiv, farbe: "#e8eaf0" },
            ]}
          />
          <div className="mt-4">
            <Linie werte={vereine.map((v) => ({ label: monatKurz(v.monat), wert: Number(v.gesamt) }))} farbe="#c9921f" hoehe={90} />
          </div>
        </section>
        <section className={KARTE}>
          <KarteKopf icon={MessageSquare} titel="Aktivität – Nachrichten pro Woche" />
          <Balken werte={nachrichten.map((n) => ({ label: n.woche.slice(-2), wert: Number(n.anzahl) }))} farbe="#5b3fd1" />
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-brand-ink-soft">
            <Radio size={13} /> Gezählt wird nur die Anzahl – Inhalte und Absender sieht die Administration nicht.
          </p>
        </section>
      </div>
    </div>
  );
}
