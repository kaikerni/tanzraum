import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGruppenOptionen, getKontakte, getVerbindungen } from "@/lib/chat/getChat";
import { NeuerChat } from "@/components/chat/NeuerChat";

export default async function NeuerChatSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [kontakte, gruppen, verbindungen] = await Promise.all([getKontakte(supabase), getGruppenOptionen(supabase), getVerbindungen(supabase)]);
  return <NeuerChat kontakte={kontakte} gruppen={gruppen} verbindungen={verbindungen} />;
}
