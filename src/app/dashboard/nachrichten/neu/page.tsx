import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getKontaktanfragen, getKontakte } from "@/lib/chat/getChat";
import { NeuerChat } from "@/components/chat/NeuerChat";

export default async function NeuerChatSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // FREE: keine Chatuebersicht – Direktnachrichten entstehen aus dem Profil
  const { data: tarif } = await supabase.rpc("mein_tarif");
  if (tarif !== "basic" && tarif !== "verein") redirect("/dashboard/netzwerk/suche");

  const [kontakte, anfragen] = await Promise.all([getKontakte(supabase), getKontaktanfragen(supabase)]);
  return <NeuerChat kontakte={kontakte} anfragen={anfragen} />;
}
