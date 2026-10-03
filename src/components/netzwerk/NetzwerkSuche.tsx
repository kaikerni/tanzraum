"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { suchen } from "@/app/dashboard/trainer-netzwerk/actions";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { StatusChip } from "./NetzwerkAktion";
import type { NetzwerkTreffer } from "@/lib/netzwerk/getNetzwerk";

export function NetzwerkSuche({ platzhalter }: { platzhalter: string }) {
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<NetzwerkTreffer[] | null>(null);
  const [laeuft, starte] = useTransition();
  const zeitgeber = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (zeitgeber.current) clearTimeout(zeitgeber.current);
    const text = q.trim();
    if (text.length < 2) {
      setTreffer(null);
      return;
    }
    zeitgeber.current = setTimeout(() => starte(async () => setTreffer(await suchen(text))), 300);
    return () => {
      if (zeitgeber.current) clearTimeout(zeitgeber.current);
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-line bg-white px-3 text-brand-ink-soft focus-within:border-brand-red">
        <Search size={17} />
        <span className="sr-only">Suche</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={platzhalter}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-brand-ink outline-none placeholder:text-brand-ink-faint"
        />
        {laeuft && <span className="text-[12px] text-brand-ink-faint">Suche …</span>}
      </label>
      {q.trim().length > 0 && q.trim().length < 2 && <p className="text-[12.5px] text-brand-ink-faint">Mindestens 2 Zeichen eingeben.</p>}
      {treffer && treffer.length === 0 && !laeuft && (
        <p className="rounded-xl bg-brand-bg px-3 py-3 text-[13.5px] text-brand-ink-soft">Niemanden gefunden. Tipp: Suche nach Vor-, Nachname oder @Nutzername.</p>
      )}
      {treffer && treffer.length > 0 && (
        <ul className="flex flex-col divide-y divide-brand-line rounded-2xl border border-brand-line bg-white">
          {treffer.map((t) => (
            <li key={t.userId}>
              <Link href={`/dashboard/trainer-netzwerk/${t.userId}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand-bg/60">
                <ChatAvatar typ="dm" name={t.anzeige} avatarUrl={t.avatarUrl} groesse={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-brand-ink">{t.anzeige}</p>
                  <p className="truncate text-[12.5px] text-brand-ink-soft">
                    {[t.handle ? `@${t.handle}` : null, t.vereine].filter(Boolean).join(" · ") || "TanzRaum-Mitglied"}
                  </p>
                </div>
                <StatusChip status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
