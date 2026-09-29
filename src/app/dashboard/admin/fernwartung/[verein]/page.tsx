import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileSignature, LayoutGrid, ShieldAlert } from "lucide-react";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { adminSitzung } from "@/lib/admin/zugang";
import { einstellungenAus, inhaltAus } from "@/lib/antraege/vorlage";
import { BereicheFormular } from "@/components/verwaltung/BereicheFormular";
import { FernwartungVereinsdaten } from "@/components/admin/FernwartungVereinsdaten";
import { VorlageEditor } from "@/components/antraege/VorlageEditor";

export const metadata = { title: "Fernwartung – TanzRaum-Administration" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Daten = {
  id: string;
  name: string;
  module_aus: string[];
  gruppen: { name: string; mitglieder: number }[];
  mitglieder_anzahl: number;
  antrag_vorlage: { inhalt: unknown; einstellungen: unknown } | null;
  [k: string]: unknown;
};

// Konfiguration eines Vereins waehrend einer aktiven Fernwartung – ohne Personendaten
export default async function FernwartungVereinSeite({ params }: { params: Promise<{ verein: string }> }) {
  const { verein } = await params;
  if (!UUID.test(verein)) notFound();
  const { supabase } = await adminSitzung(`/dashboard/admin/fernwartung/${verein}`);
  const { data, error } = await supabase.rpc("fernwartung_vereinsdaten", { p_verein_id: verein });
  const d = data as Daten | null;

  if (error || !d) {
    return (
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        <Link href="/dashboard/admin/fernwartung" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> Fernwartung
        </Link>
        <section className={`${KARTE} flex items-start gap-3`}>
          <ShieldAlert size={22} className="shrink-0 text-brand-red" />
          <p className="text-[14px] text-brand-ink">Für diesen Verein ist keine Fernwartung (mehr) freigegeben. Der Vereinsadmin kann sie in der Vereinsverwaltung anfragen.</p>
        </section>
      </div>
    );
  }
  const text = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href="/dashboard/admin/fernwartung" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> Fernwartung
      </Link>
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">{d.name}</h1>
        <p className="text-[13.5px] text-brand-ink-soft">
          {d.mitglieder_anzahl} Mitglieder · {d.gruppen.length} Gruppen · Jede Änderung erscheint im Protokoll des Vereins.
        </p>
      </div>
      <section className={KARTE}>
        <KarteKopf icon={Building2} titel="Vereinsdaten" />
        <FernwartungVereinsdaten
          vereinId={d.id}
          daten={Object.fromEntries(["name", "kuerzel", "beschreibung", "email", "telefon", "webseite", "strasse", "hausnummer", "plz", "ort"].map((k) => [k, text(k)]))}
        />
      </section>
      <section className={KARTE}>
        <KarteKopf icon={LayoutGrid} titel="Bereiche" />
        <BereicheFormular vereinId={d.id} aus={d.module_aus ?? []} />
      </section>
      {d.gruppen.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={LayoutGrid} titel="Tanzgruppen (nur Anzahl)" />
          <ul className="grid grid-cols-1 gap-1.5 text-[13.5px] sm:grid-cols-2">
            {d.gruppen.map((g) => (
              <li key={g.name} className="flex justify-between rounded-lg bg-brand-bg px-3 py-2">
                <span className="text-brand-ink">{g.name}</span>
                <span className="tabular-nums text-brand-ink-soft">{g.mitglieder}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-brand-ink">
          <FileSignature size={18} className="text-brand-red" /> Mitgliedsantrag-Formular
        </h2>
        <VorlageEditor
          vereinId={d.id}
          vereinName={d.name}
          hatLogo={false}
          logoPasst={false}
          gruppen={d.gruppen.map((g) => g.name)}
          start={inhaltAus(d.antrag_vorlage?.inhalt)}
          startEinstellungen={einstellungenAus(d.antrag_vorlage?.einstellungen)}
        />
      </section>
    </div>
  );
}
