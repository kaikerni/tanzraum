import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChatListe, getKontaktanfragen } from "@/lib/chat/getChat";
import { ChatRahmen } from "@/components/chat/ChatRahmen";
import { getNetzwerkModus, NETZWERK_TITEL } from "@/lib/netzwerk/getNetzwerk";

export const metadata: Metadata = { title: "Nachrichten – TanzRaum" };

export default async function NachrichtenLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [chats, anfragen, modus] = await Promise.all([getChatListe(supabase), getKontaktanfragen(supabase), getNetzwerkModus(supabase)]);
  return (
    <ChatRahmen start={chats} anfragen={anfragen} netzwerkTitel={NETZWERK_TITEL[modus ?? "trainer"]}>
      {children}
    </ChatRahmen>
  );
}
