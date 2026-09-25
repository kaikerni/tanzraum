"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, MapPin, Users, Building2, Theater, GraduationCap, ChevronRight } from "lucide-react";
import { netzwerkSuchen } from "@/app/dashboard/netzwerk/actions";
import type { ListenTreffer, NetzwerkKategorie } from "@/lib/netzwerk/tanzraumNetzwerk";
import { farbeFuer, initialen } from "@/components/chat/ChatAvatar";

const KATEGORIEN: { wert: NetzwerkKategorie; titel: string; icon: typeof Users }[] = [
  { wert: "mitglieder", titel: "Mitglieder", icon: Users },
  { wert: "vereine", titel: "Vereine", icon: Building2 },
  { wert: "gruppen", titel: "Tanzgruppen", icon: Theater },
  { wert: "trainer", titel: "Trainer", icon: GraduationCap },
];

const STATUS: Record<string, { text: string; klasse: string }> = {
  verbunden: { text: "Vernetzt", klasse: "bg-brand-green-wash text-brand-green" },
  angefragt: { text: "Angefragt", klasse: "bg-brand-gold-wash text-brand-gold" },
  eingehend: { text: "Fragt dich an", klasse: "bg-brand-red-wash text-brand-red" },
};

function Bild({ t }: { t: ListenTreffer }) {
  if (t.avatarUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={t.avatarUrl} alt="" className={`h-12 w-12 shrink-0 object-cover ${t.art === "person" ? "rounded-full" : "rounded-xl"}`} />;
  if (t.art === "person")
    return <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white ${farbeFuer(t.name)}`}>{initialen(t.name)}</span>;
  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${t.art === "verein" ? "bg-brand-red text-white" : "bg-brand-purple-wash text-brand-purple"}`}>
      {t.art === "verein" ? <Building2 size={22} /> : <Theater size={22} />}
    </span>
  );
}

export function NetzwerkListe() {
  const [kategorie, setKategorie] = useState<NetzwerkKategorie>("mitglieder");
  const [suche, setSuche] = useState("");
  const [ort, setOrt] = useState("");
  const [treffer, setTreffer] = useState<ListenTreffer[] | null>(null);
  const [laeuft, starte] = useTransition();
  const zaehler = useRef(0);

  // Serverseitige Suche, leicht verzoegert
  useEffect(() => {
    const nr = ++zaehler.current;
    const t = setTimeout(
      () =>
        starte(async () => {
          const r = await netzwerkSuchen(suche.trim(), kategorie, ort.trim());
          if (nr === zaehler.current) setTreffer(r);
        }),
      suche || ort ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [suche, ort, kategorie]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-[var(--radius-l)] border border-brand-line bg-white p-3 shadow-[var(--shadow)]">
        <label className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-bg px-3 text-brand-ink-soft">
          <Search size={17} />
          <span className="sr-only">Suchen</span>
          <input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Mitglieder, Vereine und Gruppen suchen …"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-brand-ink outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Kategorie">
            {KATEGORIEN.map(({ wert, titel, icon: Icon }) => (
              <button
                key={wert}
                type="button"
                role="tab"
                aria-selected={kategorie === wert}
                onClick={() => setKategorie(wert)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${
                  kategorie === wert ? "bg-brand-red text-white" : "bg-brand-bg text-brand-ink hover:bg-brand-line"
                }`}
              >
                <Icon size={14} /> {titel}
              </button>
            ))}
          </div>
          <label className="ml-auto flex min-h-9 min-w-[160px] flex-1 items-center gap-1.5 rounded-full border border-brand-line px-3 text-brand-ink-soft sm:flex-none">
            <MapPin size={14} />
            <span className="sr-only">Ort oder PLZ</span>
            <input value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="Ort / PLZ" className="min-w-0 flex-1 bg-transparent text-[13px] text-brand-ink outline-none" />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)]" aria-busy={laeuft}>
        {treffer === null ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-brand-ink-soft">Lädt …</p>
        ) : treffer.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-brand-ink-soft">
            {suche || ort ? "Keine Treffer. Versuche einen anderen Namen oder Ort." : "Hier ist noch niemand zu finden."}
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {treffer.map((t) => {
              const href =
                t.art === "person"
                  ? `/dashboard/netzwerk/person/${t.id}`
                  : t.art === "verein"
                    ? `/dashboard/netzwerk/verein/${t.id}`
                    : `/dashboard/netzwerk/verein/${t.vereinId}#gruppe-${t.id}`;
              const status = t.status ? STATUS[t.status] : null;
              return (
                <li key={`${t.art}-${t.id}`}>
                  <Link href={href} className="flex items-center gap-3 px-3 py-2.5 hover:bg-brand-bg sm:px-4">
                    <Bild t={t} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[14.5px] font-bold text-brand-ink">
                        <span className="truncate">{t.name}</span>
                        {status && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.klasse}`}>{status.text}</span>}
                      </p>
                      {t.zeile1 && <p className="truncate text-[12.5px] text-brand-ink-soft">{t.zeile1}</p>}
                      {t.zeile2 && <p className="truncate text-[12.5px] text-brand-ink-faint">{t.zeile2}</p>}
                    </div>
                    <ChevronRight size={17} className="shrink-0 text-brand-ink-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
