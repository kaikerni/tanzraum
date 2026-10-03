import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { netzwerkZugang } from "@/lib/netzwerk/netzwerkZugang";
import { BuddyListe, type Buddy } from "@/components/netzwerk/BuddyListen";

export const metadata = { title: "Meine Buddys – TanzRaum-Netzwerk" };

// Meine Buddys (ab BASIC) – bestehende Verbindungen (connections), mit Online-Status
export default async function BuddysSeite() {
  const supabase = await createClient();
  const { darf } = await netzwerkZugang(supabase);
  if (!darf("buddys")) redirect("/dashboard/netzwerk/suche");
  const { data } = await supabase.rpc("meine_buddys");
  // deno-lint-ignore no-explicit-any
  const buddys: Buddy[] = ((data ?? []) as any[]).map((b) => ({
    userId: b.user_id,
    anzeige: b.anzeige,
    handle: b.handle,
    avatarUrl: b.avatar_url,
    vereine: b.vereine || null,
    online: b.online === true,
    darfSchreiben: b.darf_schreiben === true,
  }));
  return <BuddyListe start={buddys} />;
}
