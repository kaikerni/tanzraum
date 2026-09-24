import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChatListe, getChatStatus } from "@/lib/chat/getChat";
import { ChatRahmen } from "@/components/chat/ChatRahmen";

export default async function NachrichtenLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [chats, status] = await Promise.all([getChatListe(supabase), getChatStatus(supabase)]);
  return (
    <ChatRahmen start={chats} status={status}>
      {children}
    </ChatRahmen>
  );
}
