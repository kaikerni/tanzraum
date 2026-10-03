import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChatListe, getKontaktanfragen } from "@/lib/chat/getChat";
import { ChatRahmen } from "@/components/chat/ChatRahmen";
import { getNetzwerkModus, NETZWERK_TITEL } from "@/lib/netzwerk/getNetzwerk";

export const metadata: Metadata = { title: "Nachrichten – TanzRaum" };

// Messenger: Chatuebersicht, Gruppenchats usw. ab BASIC (oder ueber die Vereinslizenz).
// FREE: nur der einzelne Direktchat (aus dem Profil bzw. der Dashboard-Karte „Nachrichten“) – ohne Chatliste.
export default async function NachrichtenLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: tarif }, { data: admin }] = await Promise.all([supabase.rpc("mein_tarif"), supabase.rpc("ist_plattform_admin_aktuell")]);
  if (tarif !== "basic" && tarif !== "verein" && admin !== true) {
    return (
      <div className="-mx-3 -mb-28 -mt-4 flex h-[calc(100dvh-125px-env(safe-area-inset-bottom))] overflow-hidden bg-white sm:-mx-5 md:-mb-8 md:-mt-5 md:h-[calc(100dvh-84px)] xl:-mx-6">
        <section className="flex min-w-0 flex-1 flex-col">{children}</section>
      </div>
    );
  }

  const [chats, anfragen, modus] = await Promise.all([getChatListe(supabase), getKontaktanfragen(supabase), getNetzwerkModus(supabase)]);
  return (
    <ChatRahmen start={chats} anfragen={anfragen} netzwerkTitel={NETZWERK_TITEL[modus ?? "trainer"]}>
      {children}
    </ChatRahmen>
  );
}
