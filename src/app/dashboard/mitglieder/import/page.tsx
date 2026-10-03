import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { MitgliederImport } from "@/components/mitglieder/MitgliederImport";

export const metadata = { title: "Mitglieder importieren" };

// Mitgliederimport (CSV/Excel) fuer Vereinsadmins eines Vereins mit Vereinslizenz.
// Die Datei wird im Browser gelesen; gespeichert wird erst nach der Vorschau (Datenbank prueft die Rechte).
export default async function MitgliederImportSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");

  const { verein: gewaehlt } = await searchParams;
  const adminVereine = daten.vereine.filter((v) => (v.rolleName ?? "").toLowerCase().includes("admin"));
  const mitgliedschaft = adminVereine.find((v) => v.vereinId === gewaehlt) ?? adminVereine[0];
  if (!mitgliedschaft) redirect("/dashboard/mitglieder");

  const [{ data: gruppen }, { data: altersklassen }] = await Promise.all([
    supabase.from("gruppen").select("id, name").eq("verein_id", mitgliedschaft.vereinId).order("name"),
    supabase.from("altersklassen").select("name"),
  ]);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <Link href={`/dashboard/mitglieder?verein=${mitgliedschaft.vereinId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={15} /> Zurück zu den Mitgliedern
      </Link>
      <MitgliederImport
        vereinId={mitgliedschaft.vereinId}
        vereinName={mitgliedschaft.vereinName ?? ""}
        gruppen={(gruppen ?? []).map((g) => ({ id: g.id as string, name: (g.name as string) ?? "Gruppe" }))}
        altersklassen={(altersklassen ?? []).map((a) => a.name as string)}
      />
    </div>
  );
}
