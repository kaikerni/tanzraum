import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMapPunkte } from "@/lib/netzwerk/tanzraumNetzwerk";
import { netzwerkZugang } from "@/lib/netzwerk/netzwerkZugang";
import { NetzwerkMap } from "@/components/netzwerk/NetzwerkMap";
import { googleMapsBrowserSchluessel } from "@/lib/geo/geocode";

export const metadata = { title: "Map – TanzRaum-Netzwerk" };

// Map (ab BASIC): Wo ist TanzRaum? Die Datenbank liefert nur, was angezeigt werden darf (netzwerk_map).
export default async function NetzwerkMapSeite({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const supabase = await createClient();
  const { darf } = await netzwerkZugang(supabase);
  if (!darf("map")) redirect("/dashboard/netzwerk/suche");
  const { verein } = await searchParams;
  const [punkte, { data: map }] = await Promise.all([getMapPunkte(supabase), supabase.rpc("meine_map_einstellungen")]);
  // deno-lint-ignore no-explicit-any
  const ichAufMap = !!((map ?? []) as any[])[0]?.wird_angezeigt;
  return (
    <>
      <p className="text-[14px] text-brand-ink-soft">Wo ist TanzRaum? Vereine und Mitglieder, die auf der Map erscheinen möchten.</p>
      <NetzwerkMap punkte={punkte} fokusVerein={verein} ichAufMap={ichAufMap} schluessel={googleMapsBrowserSchluessel()} />
    </>
  );
}
