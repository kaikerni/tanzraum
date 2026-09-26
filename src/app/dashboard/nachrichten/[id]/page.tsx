import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChatKopf, getChatNachrichten, signierteBildUrls } from "@/lib/chat/getChat";
import { ChatFenster } from "@/components/chat/ChatFenster";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function ChatSeite({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const kopf = await getChatKopf(supabase, id);
  if (!kopf) notFound();

  const [nachrichten, { data: stumm }, { data: profil }] = await Promise.all([
    getChatNachrichten(supabase, id),
    supabase.rpc("chat_ist_stumm", { p_gespraech_id: id }),
    supabase.from("profiles").select("vorname, handle").eq("id", user.id).maybeSingle(),
  ]);
  const bilder = await signierteBildUrls(
    supabase,
    nachrichten.map((n) => n.bildPfad).filter((p): p is string => !!p),
  );

  return (
    <ChatFenster
      key={id}
      kopf={kopf}
      start={nachrichten}
      startBilder={bilder}
      userId={user.id}
      meinName={profil?.vorname || (profil?.handle ? `@${profil.handle}` : "Jemand")}
      stumm={Boolean(stumm)}
    />
  );
}
