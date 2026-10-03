import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { netzwerkZugang } from "@/lib/netzwerk/netzwerkZugang";

// Einstieg ins TanzRaum-Netzwerk: die Map ist die Standardansicht (ab BASIC), FREE startet bei „Nutzer suchen“.
// Alte Links (?ansicht=liste, ?verein=…) fuehren weiterhin an die richtige Stelle.
export default async function NetzwerkStart({ searchParams }: { searchParams: Promise<{ ansicht?: string; verein?: string }> }) {
  const supabase = await createClient();
  const { voll } = await netzwerkZugang(supabase);
  const { ansicht, verein } = await searchParams;
  if (!voll) redirect("/dashboard/netzwerk/suche");
  if (ansicht === "liste") redirect("/dashboard/netzwerk/suche");
  redirect(verein ? `/dashboard/netzwerk/map?verein=${encodeURIComponent(verein)}` : "/dashboard/netzwerk/map");
}
