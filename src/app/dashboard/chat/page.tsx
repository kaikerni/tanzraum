import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getChatNachrichten } from "@/lib/chat/getChat";
import { ChatFenster } from "@/components/chat/ChatFenster";
import type { ChatKopf } from "@/lib/chat/getChat";

export const metadata = { title: "TanzRaum Chat" };

type Status = {
  id: string;
  darf_schreiben: boolean;
  sperre_bis: string | null;
  unter_16: boolean;
  eltern_sperre: boolean;
  regeln_bestaetigt: boolean;
  max_laenge: number;
  moderation: boolean;
};

// 💬 TanzRaum Chat – oeffentlicher Live-Chat der Community. Jede Nachricht wird vor der Veroeffentlichung von der
// TanzRaum Schutzpruefung geprueft. Freigabe (an/aus, Tarife) legt der TanzRaum-Admin fest.
export default async function TanzRaumChat() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/chat");

  const [{ data: status }, { data: profil }, { data: online }] = await Promise.all([
    supabase.rpc("tanzraum_chat"),
    supabase.from("profiles").select("vorname, handle").eq("id", user.id).maybeSingle(),
    supabase.rpc("online_anzahl"),
  ]);
  const s = status as Status | null;
  if (!s?.id) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col items-center gap-3 rounded-2xl border border-brand-line bg-white p-6 text-center">
        <MessageCircle size={32} className="text-brand-red" />
        <h1 className="text-[20px] font-extrabold text-brand-ink">TanzRaum Chat</h1>
        <p className="text-[14px] text-brand-ink-soft">Der TanzRaum Chat ist für dein Konto gerade nicht freigeschaltet.</p>
        <Link href="/dashboard/treff" className="text-[14px] font-semibold text-brand-red">
          Zum TanzRaum Treff →
        </Link>
      </div>
    );
  }

  const nachrichten = await getChatNachrichten(supabase, s.id);
  const sperrgrund = s.darf_schreiben
    ? null
    : s.sperre_bis
      ? "chat_gesperrt"
      : s.eltern_sperre
        ? "eltern_sperre_ich"
        : s.unter_16
          ? "chat_ab_16"
          : "chat_gesperrt";
  const kopf: ChatKopf = {
    id: s.id,
    typ: "tanzraum",
    name: "TanzRaum Chat",
    untertitel: null,
    partnerId: null,
    avatarUrl: null,
    darfSchreiben: s.darf_schreiben,
    istLeitung: s.moderation,
    nurLeitungSchreibt: false,
    partnerGelesenBis: null,
    partnerZugestelltBis: null,
    partnerRolle: null,
    ichHabeBlockiert: false,
    partnerBlockiert: false,
    sperrgrund,
  };

  return (
    <div className="-mx-3 -mb-28 -mt-4 flex h-[calc(100dvh-125px-env(safe-area-inset-bottom))] overflow-hidden bg-white sm:-mx-5 md:-mb-8 md:-mt-5 md:h-[calc(100dvh-84px)] xl:-mx-6">
      <section className="flex min-w-0 flex-1 flex-col">
        <ChatFenster
          kopf={kopf}
          start={nachrichten}
          startBilder={{}}
          userId={user.id}
          meinName={profil?.vorname || (profil?.handle ? `@${profil.handle}` : "Jemand")}
          zurueckHref="/dashboard"
          tanzraum={{ maxLaenge: s.max_laenge || 1000, regelnBestaetigt: s.regeln_bestaetigt, online: typeof online === "number" ? online : null }}
        />
      </section>
    </div>
  );
}
