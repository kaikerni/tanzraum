import type { SupabaseClient } from "@supabase/supabase-js";
import { getChatListe } from "@/lib/chat/getChat";

export type AktuelleNachricht = {
  id: string;
  inhalt: string;
  gesendetAm: string;
  senderName: string;
  ungelesen: boolean;
};

/**
 * Die zuletzt aktiven Chats (chat_liste) -- nur Chats, auf die der Nutzer selbst Zugriff hat.
 * Kein Admin-Bypass: Ein Plattform-Admin sieht hier keine fremden privaten Chats.
 */
export async function getAktuelleNachrichten(supabase: SupabaseClient, _userId: string, anzahl = 4): Promise<AktuelleNachricht[]> {
  const chats = await getChatListe(supabase);
  return chats
    .filter((c) => c.letzteNachricht)
    .slice(0, anzahl)
    .map((c) => ({
      id: c.id,
      inhalt: c.letzterSender ? `${c.letzterSender}: ${c.letzteNachricht}` : (c.letzteNachricht ?? ""),
      gesendetAm: c.letzteZeit,
      senderName: c.name,
      ungelesen: c.ungelesen > 0,
    }));
}
