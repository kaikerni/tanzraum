import Link from "next/link";
import { redirect } from "next/navigation";
import { HardDrive } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SpeicherVerwaltung } from "@/components/admin/SpeicherVerwaltung";
import type { SpeicherUebersicht } from "@/lib/speicher";

export const metadata = { title: "Speicher & Kontingente – TanzRaum-Administration" };

// Zentrale Speicherverwaltung: freigegebener Gesamtspeicher, technischer Speicher (Info) und Kontingente je Bereich.
export default async function SpeicherSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/admin/speicher");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data, error } = await supabase.rpc("admin_speicher_uebersicht");
  // deno-lint-ignore no-explicit-any
  const d = (data ?? {}) as any;
  const uebersicht: SpeicherUebersicht | null =
    error || !data
      ? null
      : {
          gesamtMb: d.gesamt_mb,
          technischMb: d.technisch_mb ?? null,
          belegt: Number(d.belegt ?? 0),
          dateien: Number(d.dateien ?? 0),
          nutzer: Number(d.nutzer ?? 0),
          vereine: Number(d.vereine ?? 0),
          sonstige: Number(d.sonstige ?? 0),
          // deno-lint-ignore no-explicit-any
          kategorien: ((d.kategorien ?? []) as any[]).map((k) => ({
            schluessel: k.schluessel,
            bezeichnung: k.bezeichnung,
            beschreibung: k.beschreibung ?? null,
            bezug: k.bezug,
            pruefung: k.pruefung,
            buckets: k.buckets ?? [],
            limitMb: k.limit_mb,
            aktiv: k.aktiv,
            belegt: Number(k.belegt ?? 0),
            dateien: Number(k.dateien ?? 0),
            geaendertAm: k.geaendert_am ?? null,
          })),
          // deno-lint-ignore no-explicit-any
          topVereine: ((d.top_vereine ?? []) as any[]).map((x) => ({ name: x.name, belegt: Number(x.belegt) })),
          // deno-lint-ignore no-explicit-any
          topNutzer: ((d.top_nutzer ?? []) as any[]).map((x) => ({ name: x.name, belegt: Number(x.belegt) })),
        };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[960px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <HardDrive size={24} className="text-brand-red" /> Speicher &amp; Kontingente
        </h1>
        <p className="text-[14px] text-brand-ink-soft">
          Wie viel Speicher TanzRaum nutzen darf und wie viel davon jeder Verein bzw. jede Person je Bereich bekommt. Änderungen gelten sofort –
          ohne neuen Build. Beim Verringern wird nie etwas gelöscht.
        </p>
      </div>
      {uebersicht ? (
        <SpeicherVerwaltung u={uebersicht} />
      ) : (
        <p className="rounded-xl bg-brand-red-wash px-4 py-3 text-[13.5px] text-brand-red">Die Speicherübersicht konnte nicht geladen werden.</p>
      )}
    </div>
  );
}
