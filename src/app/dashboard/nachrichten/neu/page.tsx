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

  const [kontakte, anfragen] = await Promise.all([getKontakte(supabase), getKontaktanfragen(supabase)]);
  return <NeuerChat kontakte={kontakte} anfragen={anfragen} />;
}
