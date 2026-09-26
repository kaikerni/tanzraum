import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";

export const metadata = { title: "Benachrichtigungen – TanzRaum" };

// Ziel je Benachrichtigungsart (unbekannte Arten ohne Link)
function ziel(typ: string): string | null {
  if (typ.startsWith("ehrung_")) return "/dashboard/vereinsverwaltung/ehrungen";
  if (typ === "termin_erinnerung" || typ === "termin") return "/dashboard/kalender";
  if (typ === "tarif_kauf") return "/dashboard/admin/tarife";
  if (typ.includes("netzwerk") || typ === "kontaktanfrage") return "/dashboard/netzwerk";
  return null;
}

export default async function Benachrichtigungen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/benachrichtigungen");
  // RLS: nur eigene Benachrichtigungen
  const { data } = await supabase
    .from("benachrichtigungen")
    .select("id, typ, text, gelesen, erstellt_am")
    .eq("user_id", user.id)
    .order("erstellt_am", { ascending: false })
    .limit(100);
  const liste = data ?? [];
  const ungelesen = liste.filter((b) => !b.gelesen).map((b) => b.id);
  if (ungelesen.length) await supabase.from("benachrichtigungen").update({ gelesen: true }).in("id", ungelesen);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
        <Bell size={22} /> Benachrichtigungen
      </h1>
      {liste.length === 0 ? (
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>Keine Benachrichtigungen.</p>
      ) : (
        <ul className={`${KARTE} divide-y divide-brand-line p-0 sm:p-0`}>
          {liste.map((b) => {
            const href = ziel(b.typ);
            const inhalt = (
              <>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14px] ${b.gelesen ? "text-brand-ink" : "font-semibold text-brand-ink"}`}>{b.text}</span>
                  <span className="text-[12px] text-brand-ink-soft">
                    {new Date(b.erstellt_am).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" })}
                    {!b.gelesen && <span className="ml-2 rounded-full bg-brand-red px-2 py-0.5 text-[10.5px] font-bold text-white">neu</span>}
                  </span>
                </span>
                {href && <ChevronRight size={17} className="shrink-0 text-brand-ink-faint" />}
              </>
            );
            return (
              <li key={b.id}>
                {href ? (
                  <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-bg">
                    {inhalt}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">{inhalt}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
