"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment, useRouter } from "next/navigation";
import { Search, SquarePen, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { alsChatEintrag, type ChatEintrag } from "@/lib/chat/getChat";
import { ChatAvatar, zeitKurz } from "./ChatAvatar";

export function ChatRahmen({ start, children }: { start: ChatEintrag[]; children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const [chats, setChats] = useState(start);
  const [suche, setSuche] = useState("");
  const offen = segment && segment !== "neu" ? segment : null;
  const imChat = segment !== null;
  const zeitgeber = useRef<ReturnType<typeof setTimeout> | null>(null);

  const neuLaden = useCallback(() => {
    if (zeitgeber.current) clearTimeout(zeitgeber.current);
    zeitgeber.current = setTimeout(async () => {
      const { data } = await createClient().rpc("chat_liste");
      // deno-lint-ignore no-explicit-any
      if (data) setChats((data as any[]).map(alsChatEintrag));
      router.refresh();
    }, 400);
  }, [router]);

  useEffect(() => setChats(start), [start]);

  // Neue Nachrichten in allen sichtbaren Chats (RLS filtert serverseitig) aktualisieren Liste und Zaehler.
  useEffect(() => {
    const supabase = createClient();
    const kanal = supabase
      .channel("chatliste")
      .on("postgres_changes", { event: "*", schema: "public", table: "nachrichten" }, neuLaden)
      .subscribe();
    return () => {
      supabase.removeChannel(kanal);
    };
  }, [neuLaden]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return q ? chats.filter((c) => `${c.name} ${c.untertitel ?? ""}`.toLowerCase().includes(q)) : chats;
  }, [chats, suche]);

  return (
    <div className="-mx-3 -mb-28 -mt-4 flex h-[calc(100dvh-125px-env(safe-area-inset-bottom))] overflow-hidden border-brand-line bg-white sm:-mx-5 md:-mb-8 md:-mt-5 md:h-[calc(100dvh-76px)] xl:-mx-6">
      <aside
        className={`${imChat ? "hidden lg:flex" : "flex"} w-full shrink-0 flex-col border-r border-brand-line bg-white lg:w-[360px]`}
        aria-label="Chats"
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h1 className="text-[22px] font-extrabold tracking-tight text-brand-ink">Nachrichten</h1>
          <Link
            href="/dashboard/nachrichten/neu"
            aria-label="Neuer Chat"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-red text-white hover:bg-brand-red-deep"
          >
            <SquarePen size={18} />
          </Link>
        </div>
        <div className="px-4 pb-3">
          <label className="flex min-h-10 items-center gap-2 rounded-xl bg-brand-bg px-3 text-brand-ink-soft focus-within:ring-1 focus-within:ring-brand-red">
            <Search size={16} />
            <span className="sr-only">Chats durchsuchen</span>
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Suchen"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-brand-ink outline-none placeholder:text-brand-ink-faint"
            />
          </label>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {gefiltert.length === 0 && (
            <li className="px-5 py-8 text-center text-[13.5px] text-brand-ink-soft">
              {chats.length === 0 ? (
                <>
                  Noch keine Chats.
                  <br />
                  <Link href="/dashboard/nachrichten/neu" className="font-semibold text-brand-red">
                    Neuen Chat starten
                  </Link>
                </>
              ) : (
                "Kein Chat gefunden."
              )}
            </li>
          )}
          {gefiltert.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/nachrichten/${c.id}`}
                aria-current={offen === c.id ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 ${offen === c.id ? "bg-brand-bg" : "hover:bg-brand-bg/60"}`}
              >
                <ChatAvatar typ={c.typ} name={c.name} avatarUrl={c.avatarUrl} />
                <div className="min-w-0 flex-1 border-b border-brand-line/70 pb-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 truncate text-[15px] font-semibold text-brand-ink">
                      {c.typ === "platform" && <Megaphone size={13} className="shrink-0 text-brand-red" />}
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className={`shrink-0 text-[11.5px] ${c.ungelesen > 0 ? "font-semibold text-brand-green" : "text-brand-ink-faint"}`}>
                      {zeitKurz(c.letzteZeit)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] text-brand-ink-soft">
                      {c.letzteNachricht ? (
                        <>
                          {c.letzterSender && <span className="font-medium text-brand-ink">{c.letzterSender}: </span>}
                          {c.letzteNachricht}
                        </>
                      ) : (
                        (c.untertitel ?? "Noch keine Nachrichten")
                      )}
                    </span>
                    {c.ungelesen > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-green px-1.5 text-[11px] font-bold text-white">
                        {c.ungelesen >= 99 ? "99+" : c.ungelesen}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className={`${imChat ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col`}>{children}</section>
    </div>
  );
}
