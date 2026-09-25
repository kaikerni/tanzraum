import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { SortierteListe, type ListenEintrag } from "@/components/admin/SortierteListe";
import { VereinslizenzKarte, type VereinslizenzStatus } from "@/components/verein/VereinslizenzKarte";
import { ABO_STATUS_LABEL, ANBIETER_LABEL, PERIODE_LABEL, TARIF_LABEL, datum } from "@/lib/tarife";

export const metadata = { title: "Verein – Tarife" };

type Mitglied = {
  user_id: string;
  name: string;
  rolle: string | null;
  aktiv: boolean;
  beigetreten: string | null;
  persoenlicher_tarif: string;
  abo_status: string | null;
  anbieter: string | null;
  periode: string | null;
  effektiv: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminVereinTarifSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");

  const [{ data: vereineRoh }, { data: lizenz }, { data: mitgliederRoh }] = await Promise.all([
    supabase.rpc("admin_vereinslizenzen"),
    supabase.rpc("vereinslizenz_status", { p_verein_id: id }),
    supabase.rpc("admin_verein_mitglieder", { p_verein_id: id }),
  ]);
  const verein = ((vereineRoh ?? []) as { verein_id: string; name: string; ort: string | null }[]).find((v) => v.verein_id === id);
  if (!verein) notFound();

  const mitglieder = (mitgliederRoh ?? []) as Mitglied[];
  const eintraege: ListenEintrag[] = mitglieder.map((m) => {
    const abo = m.abo_status
      ? [ABO_STATUS_LABEL[m.abo_status] ?? m.abo_status, m.periode ? PERIODE_LABEL[m.periode] : null, m.anbieter ? ANBIETER_LABEL[m.anbieter] : null]
          .filter(Boolean)
          .join(" · ")
      : null;
    return {
      id: m.user_id,
      name: m.name,
      seit: m.beigetreten,
      inhalt: (
        <div className="flex flex-col gap-0.5 px-3 py-2.5 text-[13.5px] sm:flex-row sm:items-center sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-brand-ink">
              {m.name}
              {!m.aktiv && <span className="ml-2 rounded-full bg-brand-bg px-2 py-0.5 text-[11.5px] font-semibold text-brand-ink-soft">inaktiv</span>}
            </div>
            <div className="text-[12.5px] text-brand-ink-soft">
              {m.rolle ?? "Mitglied"} · hat <strong className="text-brand-ink">{m.effektiv}</strong> · persönlich {TARIF_LABEL[m.persoenlicher_tarif] ?? m.persoenlicher_tarif}
              {abo && ` (${abo})`}
            </div>
          </div>
          <div className="shrink-0 text-[12px] text-brand-ink-soft">beigetreten {datum(m.beigetreten)}</div>
        </div>
      ),
    };
  });

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
      <div>
        <Link href="/dashboard/admin/tarife?stufe=verein" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
          <ArrowLeft size={14} /> Vereine
        </Link>
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">
          {verein.name}
          {verein.ort && <span className="text-[16px] font-semibold text-brand-ink-soft"> · {verein.ort}</span>}
        </h1>
      </div>
      {lizenz && <VereinslizenzKarte status={lizenz as VereinslizenzStatus} vereinId={id} verwalten={false} />}
      <section className={`${KARTE} flex flex-col gap-3`}>
        <h2 className="text-[16px] font-bold text-brand-ink">Mitglieder – wer hat was</h2>
        <SortierteListe eintraege={eintraege} leer="Dieser Verein hat keine Mitglieder mit Konto." />
      </section>
    </div>
  );
}
