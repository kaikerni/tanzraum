import Link from "next/link";
import { EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VEREINS_MODULE, type VereinsModul } from "@/lib/navigation";
import { KARTE } from "@/components/dashboard/Karten";

// Hat der eigene Verein diesen Bereich ausgeschaltet? (Plattform-Admin: nie)
export async function modulAusgeschaltet(modul: VereinsModul): Promise<boolean> {
  const supabase = await createClient();
  const [{ data: aus }, { data: istAdmin }] = await Promise.all([
    supabase.rpc("meine_module_aus"),
    supabase.rpc("ist_plattform_admin_aktuell"),
  ]);
  return istAdmin !== true && Array.isArray(aus) && (aus as string[]).includes(modul);
}

export function ModulAusHinweis({ modul }: { modul: VereinsModul }) {
  const label = VEREINS_MODULE.find((m) => m.id === modul)?.label ?? "Dieser Bereich";
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">{label}</h1>
      <section className={`${KARTE} flex flex-col items-center gap-3 py-10 text-center`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-bg text-brand-ink-soft">
          <EyeOff size={26} />
        </div>
        <p className="text-[16px] font-bold text-brand-ink">Dieser Bereich ist in deinem Verein ausgeschaltet</p>
        <p className="max-w-md text-[14px] text-brand-ink-soft">Der Vereinsadmin kann ihn in der Vereinsverwaltung unter „Bereiche“ wieder einschalten.</p>
        <Link href="/dashboard" className="mt-2 text-[13.5px] font-semibold text-brand-red">
          Zurück zum Dashboard
        </Link>
      </section>
    </div>
  );
}

// Umschliesst die Seiten eines Vereinsbereichs: ausgeschaltet -> Hinweis statt Inhalt (Daten bleiben erhalten)
export async function ModulSchutz({ modul, children }: { modul: VereinsModul; children: React.ReactNode }) {
  if (await modulAusgeschaltet(modul)) return <ModulAusHinweis modul={modul} />;
  return <>{children}</>;
}
