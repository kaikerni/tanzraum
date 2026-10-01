"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, ChevronRight, MessageCircle } from "lucide-react";
import { nutzerSuchen, type NutzerTreffer } from "@/app/dashboard/netzwerk/actions";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";

// Nutzer suchen (alle Tarife): Name oder @Nutzername. Profil oeffnen, dort „Nachricht senden“.
export function NutzerSuche() {
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<NutzerTreffer[] | null>(null);
  const [laeuft, starte] = useTransition();
  const zaehler = useRef(0);

  useEffect(() => {
    const q = suche.trim();
    const nr = ++zaehler.current;
    if (q.replace(/^@/, "").length < 3) {
      setTreffer(null);
      return;
    }
    const t = setTimeout(
      () =>
        starte(async () => {
          const r = await nutzerSuchen(q);
          if (nr === zaehler.current) setTreffer(r);
        }),
      300,
    );
    return () => clearTimeout(t);
  }, [suche]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius-l)] border border-brand-line bg-white p-3 shadow-[var(--shadow)]">
        <label className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-bg px-3 text-brand-ink-soft">
          <Search size={17} />
          <span className="sr-only">Nutzer suchen</span>
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Name oder @Nutzername (mind. 3 Zeichen)"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-brand-ink outline-none"
          />
        </label>
      </div>
      <div className="overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)]" aria-busy={laeuft}>
        {treffer === null ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-brand-ink-soft">Gib mindestens 3 Zeichen ein, um TanzRaum-Nutzer zu finden.</p>
        ) : treffer.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-brand-ink-soft">Niemand gefunden. Private Konten findest du nur über den genauen @Nutzernamen.</p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {treffer.map((t) => (
              <li key={t.userId}>
                <Link href={`/dashboard/netzwerk/person/${t.userId}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand-bg sm:px-4">
                  {t.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white ${farbeFuer(t.anzeige)}`}>{initialen(t.anzeige)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-bold text-brand-ink">{t.anzeige}</p>
                    {t.handle && <p className="truncate text-[12.5px] text-brand-ink-faint">@{t.handle}</p>}
                  </div>
                  {t.darfSchreiben && (
                    <span className="hidden shrink-0 items-center gap-1 rounded-full bg-brand-bg px-2.5 py-1 text-[12px] font-semibold text-brand-ink-soft sm:inline-flex">
                      <MessageCircle size={13} /> Nachricht möglich
                    </span>
                  )}
                  <ChevronRight size={17} className="shrink-0 text-brand-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
