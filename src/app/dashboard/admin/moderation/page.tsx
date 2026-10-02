import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Flag, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { ChatFaelle, ChatFreigabe, ChatSperren, SchutzEinstellungen, SchutzUebersicht, type ChatFall, type ChatSperre, type SchutzStatistik } from "@/components/moderation/ChatModeration";
import { darfTeam, meineTeamRechte } from "@/lib/team/rechte";

export const metadata = { title: "Moderation – TanzRaum-Administration" };

// 🛡️ Moderation: Chat-Faelle (Meldungen + automatische Schutzpruefung), Schreibsperren, Statistik, Freigabe und Schwellenwerte.
// TanzRaum-Admin: alles. Team: nur mit Chat-Rechten (Datenbank prueft jede Aktion erneut). Vereinsadmins haben hier keine Rechte.
export default async function ModerationSeite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/admin/moderation");
  const r = await meineTeamRechte(supabase);
  const [{ data: oeff }, { data: grp }] = await Promise.all([
    supabase.rpc("chat_moderation_darf", { p_oeffentlich: true }),
    supabase.rpc("chat_moderation_darf", { p_oeffentlich: false }),
  ]);
  const darfFaelle = r.admin || oeff === true || grp === true;
  const darfSperren = darfTeam(r, "chat.nutzer_stummschalten");
  if (!darfFaelle && !darfSperren) redirect("/dashboard");

  const [faelle, sperren, statistik, einstellung] = await Promise.all([
    darfFaelle ? supabase.rpc("chat_faelle", { p_status: null }) : Promise.resolve({ data: [] }),
    darfSperren ? supabase.rpc("chat_sperren_liste") : Promise.resolve({ data: [] }),
    darfFaelle ? supabase.rpc("schutz_statistik", { p_tage: 7 }) : Promise.resolve({ data: null }),
    r.admin ? supabase.from("plattform_einstellungen").select("chat_aktiv, chat_tarife").eq("id", true).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const e = einstellung.data as { chat_aktiv?: boolean; chat_tarife?: string[] } | null;
  const s = statistik.data as SchutzStatistik | null;

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-4">
      <Link href={r.admin ? "/dashboard/admin" : "/dashboard/team"} className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
        <ArrowLeft size={14} /> {r.admin ? "Administration" : "TanzRaum Team"}
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <ShieldAlert size={24} className="text-brand-red" /> Moderation
        </h1>
        <p className="text-[13.5px] text-brand-ink-soft">
          💬 Chat: TanzRaum Chat und Gruppenchats. Moderation sieht nur gemeldete bzw. blockierte Auszüge – keinen Einblick in private Gruppenchats.
        </p>
      </div>
      {r.admin && (
        <Link href="/dashboard/admin/meldungen" className={`${KARTE} flex items-center gap-3 !py-3 hover:border-brand-red`}>
          <Flag size={18} className="text-brand-ink-soft" />
          <span className="flex-1 text-[14px] font-semibold text-brand-ink">Weitere Meldungen (Spotlights, Konten) und Treff-Meldungen</span>
        </Link>
      )}
      {r.admin && e && <ChatFreigabe aktiv={e.chat_aktiv === true} tarife={e.chat_tarife ?? []} />}
      {s && <SchutzUebersicht s={s} />}
      {darfFaelle && (
        <ChatFaelle faelle={(faelle.data ?? []) as ChatFall[]} rechte={{ entfernen: darfTeam(r, "chat.nachrichten_loeschen"), sperren: darfSperren }} />
      )}
      {darfSperren && <ChatSperren sperren={(sperren.data ?? []) as ChatSperre[]} />}
      {r.admin && s && <SchutzEinstellungen werte={s.einstellungen ?? {}} />}
    </div>
  );
}
