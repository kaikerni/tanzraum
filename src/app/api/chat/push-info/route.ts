import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChatListe } from "@/lib/chat/getChat";

// Wird vom Service Worker nach einem (inhaltslosen) Push aufgerufen: Titel und Vorschau des
// neuesten ungelesenen Chats -- nur fuer den angemeldeten Nutzer selbst.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });

  // Eingehender Anruf hat Vorrang
  const { data: anruf } = await supabase.rpc("mein_eingehender_anruf");
  // deno-lint-ignore no-explicit-any
  const a = ((anruf ?? []) as any[])[0];
  if (a) {
    return NextResponse.json(
      {
        titel: a.art === "video" ? "📹 Eingehender Videoanruf" : "📞 Eingehender Sprachanruf",
        text: `${a.anrufer} ruft dich über den TanzRaum-Messenger an`,
        url: `/dashboard/nachrichten/${a.gespraech_id}`,
        tag: `anruf-${a.id}`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // TanzRaum-Ankuendigung bzw. Vereins-News mit Push (nur frische, noch nicht gelesene fuer diese Person)
  const { data: ank } = await supabase.rpc("meine_push_ankuendigung");
  // deno-lint-ignore no-explicit-any
  const ankuendigung = ((ank ?? []) as any[])[0];
  if (ankuendigung) {
    return NextResponse.json(
      { titel: ankuendigung.wichtig ? "⚠️ TanzRaum – wichtig" : "📣 TanzRaum", text: ankuendigung.titel, url: "/dashboard", tag: `ankuendigung-${ankuendigung.id}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const { data: pn } = await supabase.rpc("meine_push_news");
  // deno-lint-ignore no-explicit-any
  const news = ((pn ?? []) as any[])[0];
  if (news) {
    return NextResponse.json(
      { titel: `${news.wichtig ? "⚠️ Wichtig" : "📰 News"} · ${news.verein_name}`, text: news.titel, url: "/dashboard/news", tag: `news-${news.id}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Plattformadmin: neuer Kauf (BASIC-Abo oder Vereinslizenz) -- nur eigene, frische Benachrichtigung
  const { data: kauf } = await supabase
    .from("benachrichtigungen")
    .select("id, text")
    .eq("user_id", user.id)
    .eq("typ", "tarif_kauf")
    .eq("gelesen", false)
    .gte("erstellt_am", new Date(Date.now() - 3 * 60 * 1000).toISOString())
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (kauf) {
    return NextResponse.json(
      { titel: "💳 Neuer Kauf bei TanzRaum", text: kauf.text, url: "/dashboard/admin/tarife", tag: `kauf-${kauf.id}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const chats = await getChatListe(supabase);
  const chat = chats.find((c) => c.ungelesen > 0);
  if (!chat) return NextResponse.json({ titel: "TanzRaum-Messenger", text: "Du hast eine neue Nachricht.", url: "/dashboard/nachrichten" });

  const weitere = chats.filter((c) => c.ungelesen > 0).length - 1;
  const vorschau = `${chat.letzterSender && chat.typ !== "dm" ? `${chat.letzterSender}: ` : ""}${chat.letzteNachricht ?? "Neue Nachricht"}`;
  return NextResponse.json(
    {
      titel: chat.name,
      text: weitere > 0 ? `${vorschau}\n+ ${weitere} weitere Chats mit neuen Nachrichten` : vorschau,
      url: `/dashboard/nachrichten/${chat.id}`,
      tag: `chat-${chat.id}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
