"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { personenSuchen, type PersonTreffer } from "@/app/dashboard/admin/team/actions";
import { NutzerAvatar } from "@/components/ui/NutzerAvatar";

// Bestehenden TanzRaum-Nutzer finden (Name, @Nutzername oder vollständige E-Mail) – nur fuer den TanzRaum-Admin
export function PersonenSuche({ onWahl, hinweis }: { onWahl: (p: PersonTreffer) => void; hinweis?: string }) {
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<PersonTreffer[] | null>(null);
  useEffect(() => {
    if (q.trim().replace(/^@/, "").length < 2) return setTreffer(null);
    let aktiv = true;
    const t = setTimeout(async () => {
      const r = await personenSuchen(q.trim());
      if (aktiv) setTreffer(r);
    }, 300);
    return () => {
      aktiv = false;
      clearTimeout(t);
    };
  }, [q]);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-line bg-white px-3 focus-within:border-brand-red">
        <Search size={16} className="text-brand-ink-soft" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, @Nutzername oder E-Mail"
          className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none"
          aria-label="Person suchen"
        />
      </label>
      {hinweis && <p className="text-[12px] text-brand-ink-soft">{hinweis}</p>}
      <ul className="flex flex-col">
        {treffer?.length === 0 && <li className="px-1 py-3 text-[13.5px] text-brand-ink-soft">Niemand gefunden.</li>}
        {(treffer ?? []).map((p) => (
          <li key={p.userId}>
            <button type="button" onClick={() => onWahl(p)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-brand-bg">
              <NutzerAvatar name={p.name} avatarUrl={p.avatarUrl} groesse={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-brand-ink">{p.name}</span>
                <span className="block truncate text-[12px] text-brand-ink-soft">
                  {p.handle ? `@${p.handle}` : ""}
                  {p.email ? ` · ${p.email}` : ""} · {p.tarif.toUpperCase()}
                  {p.verein ? ` · ${p.verein}` : ""}
                  {p.team ? " · 🛡 Team" : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
