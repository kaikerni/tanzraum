import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search, CalendarRange, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { heuteBerlin } from "@/lib/training/getTraining";
import { getMeineStarts, getPlanungsVereine, getTurniere, monatsLabel, type Turnier } from "@/lib/turniere/getTurniere";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { TurnierKarte } from "@/components/turniere/TurnierKarte";
import { MeineStarts } from "@/components/turniere/MeineStarts";

export const metadata = { title: "Turniere – TanzRaum" };

type Ansicht = "kommend" | "gemerkt" | "vergangen";
const ANSICHTEN: { wert: Ansicht; label: string }[] = [
  { wert: "kommend", label: "Kommende" },
  { wert: "gemerkt", label: "Gemerkt" },
  { wert: "vergangen", label: "Vergangene" },
];

function verschieben(iso: string, tage: number) {
  const [j, m, t] = iso.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10);
}

export default async function TurniereSeite({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string; q?: string; verband?: string; kategorie?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/turniere");

  const sp = await searchParams;
  const ansicht: Ansicht = sp.ansicht === "gemerkt" || sp.ansicht === "vergangen" ? sp.ansicht : "kommend";
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const heute = heuteBerlin();

  const [von, bis] =
    ansicht === "vergangen" ? [verschieben(heute, -400), verschieben(heute, -1)] : ansicht === "gemerkt" ? [verschieben(heute, -400), verschieben(heute, 800)] : [heute, verschieben(heute, 800)];

  const [alle, meineStarts, planung] = await Promise.all([
    getTurniere(supabase, von, bis),
    getMeineStarts(supabase, heute),
    getPlanungsVereine(supabase),
  ]);

  const verbaende = [...new Set(alle.map((t) => t.verband).filter(Boolean))].sort() as string[];
  const kategorien = [...new Set(alle.map((t) => t.kategorie).filter(Boolean))].sort() as string[];

  let liste = alle.filter(
    (t) =>
      (ansicht !== "gemerkt" || t.gemerkt) &&
      (ansicht !== "vergangen" || t.letzterTag < heute) &&
      (!sp.verband || t.verband === sp.verband) &&
      (!sp.kategorie || t.kategorie === sp.kategorie) &&
      (!q || [t.name, t.ort, t.ausrichter, t.adresse].some((w) => w?.toLowerCase().includes(q))),
  );
  if (ansicht === "vergangen") liste = liste.reverse();

  const nachMonat = new Map<string, Turnier[]>();
  for (const t of liste) {
    const monat = t.ersterTag.slice(0, 7);
    nachMonat.set(monat, [...(nachMonat.get(monat) ?? []), t]);
  }

  const link = (a: Ansicht) => {
    const p = new URLSearchParams();
    if (a !== "kommend") p.set("ansicht", a);
    if (sp.q) p.set("q", sp.q);
    if (sp.verband) p.set("verband", sp.verband);
    if (sp.kategorie) p.set("kategorie", sp.kategorie);
    const s = p.toString();
    return `/dashboard/turniere${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Turniere</h1>
          <p className="text-[14px] text-brand-ink-soft">
            Turniere entdecken, merken und – mit Vereinslizenz – Starts planen. Die offizielle Anmeldung läuft weiterhin über euren
            Verband.
          </p>
        </div>
        {planung.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/saisonplanung"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
            >
              <CalendarRange size={16} /> Saisonplanung
            </Link>
            <Link
              href="/dashboard/turniere/neu"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-3.5 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
            >
              <Plus size={16} /> Vereinsturnier
            </Link>
          </div>
        )}
      </div>

      {meineStarts.length > 0 && (
        <section className={KARTE}>
          <KarteKopf icon={Trophy} titel="Deine nächsten Starts" untertitel="Gib deinem Verein Bescheid, ob du dabei bist." />
          <MeineStarts starts={meineStarts.slice(0, 12)} heute={heute} />
        </section>
      )}

      <section className={`${KARTE} flex flex-col gap-3`}>
        <nav className="flex gap-1.5 overflow-x-auto" aria-label="Ansicht">
          {ANSICHTEN.map((a) => (
            <Link
              key={a.wert}
              href={link(a.wert)}
              aria-current={ansicht === a.wert ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                ansicht === a.wert ? "bg-brand-ink text-white" : "bg-brand-bg text-brand-ink-soft hover:text-brand-ink"
              }`}
            >
              {a.label}
            </Link>
          ))}
        </nav>
        <form className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
          {ansicht !== "kommend" && <input type="hidden" name="ansicht" value={ansicht} />}
          <label className="relative">
            <span className="sr-only">Suche</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-faint" />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Name, Ort oder Ausrichter"
              className="min-h-10 w-full rounded-xl border border-brand-line pl-9 pr-3 text-[13.5px]"
            />
          </label>
          <select name="verband" defaultValue={sp.verband ?? ""} className="min-h-10 rounded-xl border border-brand-line bg-white px-3 text-[13.5px]" aria-label="Verband">
            <option value="">Alle Verbände</option>
            {verbaende.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select name="kategorie" defaultValue={sp.kategorie ?? ""} className="min-h-10 rounded-xl border border-brand-line bg-white px-3 text-[13.5px]" aria-label="Kategorie">
            <option value="">Alle Kategorien</option>
            {kategorien.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <button type="submit" className="min-h-10 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
            Filtern
          </button>
        </form>
      </section>

      {liste.length === 0 ? (
        <p className={`${KARTE} text-center text-[14px] text-brand-ink-soft`}>
          {ansicht === "gemerkt"
            ? "Du hast noch keine Turniere gemerkt. Tippe bei einem Turnier auf den Stern."
            : "Keine Turniere gefunden."}
        </p>
      ) : (
        [...nachMonat.entries()].map(([monat, turniere]) => (
          <section key={monat} className="flex flex-col gap-2">
            <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-brand-ink-soft">{monatsLabel(`${monat}-01`)}</h2>
            <ul className="flex flex-col gap-2">
              {turniere.map((t) => (
                <TurnierKarte key={t.id} t={t} heute={heute} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
