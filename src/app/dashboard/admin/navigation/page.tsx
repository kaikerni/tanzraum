import Link from "next/link";
import { redirect } from "next/navigation";
import { ListOrdered } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { NavigationTarife, type NavBereich } from "@/components/admin/NavigationTarife";
import { TARIF_BEREICHE } from "@/lib/navigation";
import { navTarifeLesen } from "@/lib/dashboard/getBereiche";

export const metadata = { title: "Navigation & Bereiche – TanzRaum-Administration" };

const HINWEIS: Record<string, string> = {
  "/dashboard/verein": "Vereinsbereiche (Mein Verein mit allen Unterpunkten)",
  "/dashboard/spotlight": "Zugriff zusätzlich über den Spotlight-Schalter der Administration",
  "/dashboard/musik": "Zugriff zusätzlich über den Musik-Schalter der Administration",
  "/juryraum/dashboard": "Nur mit JuryRaum-Berechtigung und eingeschaltetem JuryRaum",
  "/dashboard/workshops": "Vereine können Workshops zusätzlich für ihre Mitglieder ausblenden",
  "/dashboard/treff": "FREE liest, BASIC/VEREIN schreiben",
};

// Globale Nutzer-Navigation je Tarif. Rein darstellend: Ausblenden entzieht keinen Zugriff, Einblenden gewaehrt keinen.
export default async function NavigationSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: istAdmin } = await supabase.rpc("ist_plattform_admin_aktuell");
  if (istAdmin !== true) redirect("/dashboard");
  const { data } = await supabase.from("plattform_einstellungen").select("navigation_tarife").eq("id", true).maybeSingle();
  const start = navTarifeLesen((data as { navigation_tarife?: unknown } | null)?.navigation_tarife) ?? {};
  const bereiche: NavBereich[] = TARIF_BEREICHE().map((n) => ({ href: n.href, label: n.label, hinweis: HINWEIS[n.href] }));

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-4">
      <Link href="/dashboard/admin" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        ← Administration
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <ListOrdered size={24} className="text-brand-red" /> Navigation & Bereiche
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">
          Lege fest, welche Bereiche in der TanzRaum-Navigation für FREE, BASIC und VEREIN erscheinen. Das ist nur die Anzeige: Ein ausgeblendeter Bereich entzieht
          niemandem den Zugriff, und ein eingeblendeter Bereich gewährt keinen – jede Seite prüft ihre Berechtigung selbst.
        </p>
      </div>
      <section className={KARTE}>
        <NavigationTarife bereiche={bereiche} start={start} />
      </section>
      <section className={`${KARTE} text-[13.5px] text-brand-ink-soft`}>
        Deine eigene Admin-Navigation (Reihenfolge und ausgeblendete Punkte) stellst du unter{" "}
        <Link href="/dashboard/einstellungen#navigation" className="font-semibold text-brand-red">
          Einstellungen → Admin-Navigation
        </Link>{" "}
        ein.
      </section>
    </div>
  );
}
