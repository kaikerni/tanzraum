"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; name: string; avatar_url: string | null; kontakt: boolean };
type Liste = { gesamt: number; sichtbar: number; treffer: number; personen: Person[]; profile_verlinken: boolean };

const VORSCHAU = 5;

function Punkt({ gross = false }: { gross?: boolean }) {
  const g = gross ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span className={`relative flex ${g} shrink-0`} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-60 motion-reduce:hidden" />
      <span className={`relative inline-flex ${g} rounded-full bg-brand-green`} />
    </span>
  );
}

function Bild({ p }: { p: Person }) {
  const initialen =
    p.name
      .replace(/^@/, "")
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <span className="relative shrink-0">
      {p.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-red-wash text-[12px] font-bold text-brand-red">{initialen}</span>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand-green" aria-hidden />
    </span>
  );
}

const zahlText = (n: number) => `${n} TanzRaum-Nutzer online`;

// Zentrale Online-Anzeige fuer alle Dashboards.
// Zahl: online_anzahl (TanzRaum-weit, alle 60 s nur bei sichtbarem Tab – gleicher Takt wie der Herzschlag).
// Liste: online_liste erst beim Oeffnen; zeigt nur, wen man nach den bestehenden Regeln sehen darf.
export function OnlineUsers({ anzahl: start, className = "" }: { anzahl: number; className?: string }) {
  const [anzahl, setAnzahl] = useState(start);
  const [offen, setOffen] = useState(false);
  const [alle, setAlle] = useState(false);
  const [suche, setSuche] = useState("");
  const [liste, setListe] = useState<Liste | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState(false);
  const rahmen = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);

  // Zahl aktuell halten (keine Abfrage bei verborgenem Tab)
  useEffect(() => {
    const supabase = createClient();
    const holen = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase.rpc("online_anzahl");
      if (typeof data === "number") setAnzahl(data);
    };
    const takt = window.setInterval(holen, 60_000);
    document.addEventListener("visibilitychange", holen);
    return () => {
      window.clearInterval(takt);
      document.removeEventListener("visibilitychange", holen);
    };
  }, []);

  const laden = useCallback(async (begriff: string) => {
    setLaedt(true);
    setFehler(false);
    const { data, error } = await createClient().rpc("online_liste", { p_suche: begriff || null, p_limit: 100 });
    setLaedt(false);
    if (error || !data) {
      setFehler(true);
      return;
    }
    const l = data as Liste;
    setListe(l);
    setAnzahl(l.gesamt);
  }, []);

  // Liste beim Oeffnen laden; Suche mit kurzer Verzoegerung serverseitig
  useEffect(() => {
    if (!offen) return;
    const t = window.setTimeout(() => void laden(suche.trim()), suche ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [offen, suche, laden]);

  // Schliessen: Escape und Klick ausserhalb
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOffen(false);
        knopf.current?.focus();
      }
    };
    const klick = (e: MouseEvent) => {
      if (rahmen.current && !rahmen.current.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("keydown", taste);
    document.addEventListener("mousedown", klick);
    return () => {
      document.removeEventListener("keydown", taste);
      document.removeEventListener("mousedown", klick);
    };
  }, [offen]);

  const personen = liste?.personen ?? [];
  const zeige = alle || suche ? personen : personen.slice(0, VORSCHAU);
  const weitereSichtbar = Math.max(0, (liste?.sichtbar ?? 0) - VORSCHAU);
  // alle Online-Personen ausser mir, die ich nicht sehen kann (Status verborgen, privat, unter 16 ...)
  const ohneAnzeige = liste ? Math.max(0, liste.gesamt - 1 - liste.sichtbar) : 0;

  return (
    <div ref={rahmen} className={`relative ${className}`}>
      <button
        ref={knopf}
        type="button"
        onClick={() => {
          setOffen((o) => !o);
          setAlle(false);
          setSuche("");
        }}
        aria-expanded={offen}
        aria-haspopup="dialog"
        className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-brand-line bg-white px-3.5 text-[13px] font-semibold text-brand-ink shadow-sm transition-colors hover:border-brand-green/50 hover:bg-brand-green-wash"
      >
        <Punkt gross />
        <span className="truncate">
          <strong className="tabular-nums">{anzahl}</strong> TanzRaum-Nutzer online
        </span>
      </button>

      {offen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30 sm:hidden" aria-hidden onClick={() => setOffen(false)} />
          <div
            role="dialog"
            aria-label={zahlText(anzahl)}
            className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[80vh] flex-col rounded-t-2xl pb-[env(safe-area-inset-bottom)] border border-brand-line bg-white shadow-[var(--shadow)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:z-50 sm:max-h-[460px] sm:w-[340px] sm:rounded-2xl sm:pb-0"
          >
            <div className="flex items-center justify-between gap-2 border-b border-brand-line px-4 py-3">
              <p className="flex items-center gap-2 text-[14px] font-bold text-brand-ink">
                <Punkt /> {zahlText(anzahl)}
              </p>
              <button type="button" onClick={() => setOffen(false)} className="rounded-lg p-1.5 text-brand-ink-soft hover:bg-brand-bg" aria-label="Schließen">
                <X size={17} />
              </button>
            </div>

            {(alle || suche || (liste?.sichtbar ?? 0) > 8) && (
              <label className="flex items-center gap-2 border-b border-brand-line px-4 py-2">
                <Search size={15} className="shrink-0 text-brand-ink-soft" />
                <input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder="Name suchen …"
                  maxLength={60}
                  className="min-h-9 w-full bg-transparent text-[13.5px] text-brand-ink outline-none"
                  aria-label="Online-Nutzer suchen"
                />
              </label>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {fehler && <p className="px-2 py-3 text-[13px] text-brand-ink-soft">Die Liste konnte gerade nicht geladen werden.</p>}
              {!fehler && laedt && !liste && <p className="px-2 py-3 text-[13px] text-brand-ink-soft">Wird geladen …</p>}
              {!fehler && liste && zeige.length === 0 && (
                <p className="px-2 py-3 text-[13px] text-brand-ink-soft">
                  {suche ? "Niemand mit diesem Namen online." : anzahl <= 1 ? "Gerade ist sonst niemand online." : "Niemand, den du sehen kannst, ist gerade online."}
                </p>
              )}
              <ul className="flex flex-col">
                {zeige.map((p) => {
                  const inhalt = (
                    <>
                      <Bild p={p} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-brand-ink">{p.name}</span>
                      {p.kontakt && <span className="shrink-0 rounded-full bg-brand-bg px-2 py-0.5 text-[11px] font-semibold text-brand-ink-soft">Kontakt</span>}
                    </>
                  );
                  return (
                    <li key={p.id}>
                      {liste?.profile_verlinken ? (
                        <Link href={`/dashboard/netzwerk/person/${p.id}`} onClick={() => setOffen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-2 hover:bg-brand-bg">
                          {inhalt}
                        </Link>
                      ) : (
                        <div className="flex min-h-12 items-center gap-3 px-2">{inhalt}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!alle && !suche && weitereSichtbar > 0 && (
                <button type="button" onClick={() => setAlle(true)} className="mt-1 w-full rounded-xl px-2 py-2.5 text-left text-[13px] font-semibold text-brand-red hover:bg-brand-bg">
                  + {weitereSichtbar} weitere anzeigen
                </button>
              )}
              {liste && (liste.treffer > personen.length) && (
                <p className="px-2 py-2 text-[12px] text-brand-ink-soft">Es werden die ersten {personen.length} angezeigt – nutze die Suche.</p>
              )}
            </div>

            <p className="border-t border-brand-line px-4 py-2.5 text-[11.5px] leading-snug text-brand-ink-faint">
              {ohneAnzeige > 0 && (
                <>
                  {ohneAnzeige === 1 ? "1 weitere Person ist" : `${ohneAnzeige} weitere Personen sind`} online, ohne für dich sichtbar zu sein.{" "}
                </>
              )}
              Angezeigt wird nur, wer den Online-Status freigegeben hat – <Link href="/dashboard/einstellungen#online" className="underline">deine Einstellung</Link>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
