import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { netzwerkZugang } from "@/lib/netzwerk/netzwerkZugang";
import { getKontaktanfragen } from "@/lib/chat/getChat";
import { BuddyAnfragen } from "@/components/netzwerk/BuddyListen";

export const metadata = { title: "Buddy-Anfragen – TanzRaum-Netzwerk" };

// Buddy-Anfragen (ab BASIC): eingehende und gesendete Anfragen, Blockierte
export default async function BuddyAnfragenSeite() {
  const supabase = await createClient();
  const { darf } = await netzwerkZugang(supabase);
  if (!darf("anfragen")) redirect("/dashboard/netzwerk/suche");
  const anfragen = await getKontaktanfragen(supabase);
  return <BuddyAnfragen start={anfragen} />;
}
