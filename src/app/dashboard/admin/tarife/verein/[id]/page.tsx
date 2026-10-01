import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { VereinslizenzKarte, type VereinslizenzStatus } from "@/components/verein/VereinslizenzKarte";
import { LizenzManuell, VereinsadminEinladung, type AdminEinladung } from "@/components/admin/VereinVerwaltungAdmin";
import { basisUrl } from "@/lib/url";

export const metadata = { title: "Verein – Tarife" };

type Karte = { verein_id: string; nutzer: number; gruppen: number; online: number; module_aus: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminVereinTarifSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ neu?: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const [{ data: vereineRoh }, { data: lizenz }, { data: kartenRoh }, { data: einladungen }, basis, { neu }] = await Promise.all([
    supabase.rpc("admin_vereinslizenzen"),
    supabase.rpc("vereinslizenz_status", { p_verein_id: id }),
    supabase.rpc("admin_vereinskarten"),
    supabase.rpc("admin_vereinsadmin_einladungen", { p_verein_id: id }),
    basisUrl(),
    searchParams,
  ]);
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const status = lizenz as VereinslizenzStatus | null;
  const verein = ((vereineRoh ?? []) as { verein_id: string; name: string; ort: string | null }[]).find((v) => v.verein_id === id);
  if (!verein) notFound();

  // Die TanzRaum-Administration sieht nur zusammengefasste Zahlen – keine Mitgliederdaten
  const karte = ((kartenRoh ?? []) as Karte[]).find((k) => k.verein_id === id);
  const zahlen = [
    { label: "Mitglieder mit Konto", wert: karte?.nutzer ?? 0 },
    { label: "Tanzgruppen", wert: karte?.gruppen ?? 0 },
    { label: "Gerade online", wert: karte?.online ?? 0 },
    { label: "Ausgeblendete Bereiche", wert: karte?.module_aus.length ?? 0 },
  ];

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <div>
        <Link href="/dashboard/admin/tarife?stufe=verein" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> Vereine
        </Link>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">
          {verein.name}
          {verein.ort && <span className="block text-[16px] font-semibold text-brand-ink-soft sm:inline"><span className="hidden sm:inline"> · </span>{verein.ort}</span>}
        </h1>
      </div>
      {neu && (
        <p className="rounded-xl border border-brand-green/30 bg-brand-green-wash px-4 py-3 text-[14px] font-semibold text-brand-green">
          Verein angelegt. Nächste Schritte: Lizenz aktivieren und den Vereinsadmin einladen.
        </p>
      )}
      {lizenz && <VereinslizenzKarte status={lizenz as VereinslizenzStatus} vereinId={id} verwalten={false} />}
      <section className={`${KARTE} flex flex-col gap-3`}>
        <h2 className="text-[16px] font-bold text-brand-ink">Lizenz manuell aktivieren</h2>
        <p className="text-[13px] text-brand-ink-soft">
          Für Pilot- oder Sondervereinbarungen: eine normale Vereinslizenz, manuell freigeschaltet – z. B. 0 € für 1 Jahr. Gilt genauso
          wie eine bezahlte Lizenz und läuft zum Enddatum automatisch aus.
        </p>
        <LizenzManuell vereinId={id} heute={heute} manuellAktiv={status?.abo?.anbieter === "manuell"} />
      </section>
      <section className={`${KARTE} flex flex-col gap-3`}>
        <h2 className="text-[16px] font-bold text-brand-ink">Vereinsadmin einladen</h2>
        <p className="text-[13px] text-brand-ink-soft">
          Die Einladung erstellt kein Konto: Die Person öffnet den Link, registriert sich selbst bei TanzRaum (inkl. E-Mail-Bestätigung),
          meldet sich an und nimmt die Einladung an – erst dann wird sie Vereinsadmin. Der Link gilt 14 Tage und nur einmal.
        </p>
        <VereinsadminEinladung vereinId={id} basis={basis} einladungen={(einladungen ?? []) as AdminEinladung[]} lizenzAktiv={status?.aktiv === true} />
      </section>
      <section className={`${KARTE} flex flex-col gap-3`}>
        <h2 className="text-[16px] font-bold text-brand-ink">Überblick</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {zahlen.map((z) => (
            <div key={z.label} className="rounded-xl bg-brand-bg px-3 py-2.5">
              <div className="text-[22px] font-extrabold tabular-nums text-brand-ink">{z.wert}</div>
              <div className="text-[12px] text-brand-ink-soft">{z.label}</div>
            </div>
          ))}
        </div>
        <p className="text-[12.5px] text-brand-ink-soft">
          Aus Datenschutzgründen sieht die TanzRaum-Administration keine Namen oder persönlichen Daten von Vereinsmitgliedern.
        </p>
      </section>
    </div>
  );
}
