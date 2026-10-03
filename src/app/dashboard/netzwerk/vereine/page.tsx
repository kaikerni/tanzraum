import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { netzwerkZugang } from "@/lib/netzwerk/netzwerkZugang";
import { NetzwerkListe } from "@/components/netzwerk/NetzwerkListe";

export const metadata = { title: "Vereine – TanzRaum-Netzwerk" };

// Vereine entdecken (ab BASIC): Vereine und Tanzgruppen, Suche und Ortsfilter
export default async function VereineEntdeckenSeite() {
  const supabase = await createClient();
  const { darf } = await netzwerkZugang(supabase);
  if (!darf("vereine")) redirect("/dashboard/netzwerk/suche");
  return <NetzwerkListe kategorien={["vereine", "gruppen"]} platzhalter="Vereine und Tanzgruppen suchen …" />;
}
