import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, Plus, Search, SlidersHorizontal, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KARTE } from "@/components/dashboard/Karten";
import { AngebotKarte } from "@/components/boerse/AngebotKarte";
import { ART_LABEL, ZUSTAND_LABEL, bilderSignieren, getKategorien, type Angebot, type BoerseArt, type Zustand } from "@/lib/boerse";
import { ortFinden, ortssucheEingerichtet } from "@/lib/geo/geocode";

export const metadata = { title: "TanzRaum Börse – Kaufen, Verkaufen, Tauschen, Verschenken" };

type Such = Record<string, string | string[] | undefined>;
const eins = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const EURO_ZU_CENT = (v: string) => (v && Number.isFinite(Number(v.replace(",", "."))) ? String(Math.round(Number(v.replace(",", ".")) * 100)) : "");

// kleine Ablage fuer die Ortssuche (Umkreis), damit wiederholte Suchen keine neuen Anfragen ausloesen
const ortCache = new Map<string, { lat: number; lng: number } | null>();
async function ortPosition(ort: string) {
  const k = ort.trim().toLowerCase();
  if (!k || !ortssucheEingerichtet()) return null;
  if (!ortCache.has(k)) {
    const t = await ortFinden(ort);
    if (ortCache.size > 500) ortCache.clear();
    ortCache.set(k, t ? { lat: t.lat, lng: t.lng } : null);
  }
  return ortCache.get(k) ?? null;
}

function link(sp: Such, aenderung: Record<string, string | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "seite") continue;
    for (const w of Array.isArray(v) ? v : v ? [v] : []) p.append(k, w);
  }
  for (const [k, v] of Object.entries(aenderung)) {
    p.delete(k);
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return `/dashboard/boerse${s ? `?${s}` : ""}`;
}

export default async function BoerseSeite({ searchParams }: { searchParams: Promise<Such> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/boerse");
  const sp = await searchParams;
  const umkreis = eins(sp.umkreis);
  const ort = eins(sp.ort);
  const seite = Math.max(1, Number(eins(sp.seite)) || 1);

  // „Nur in meiner Naehe“: eingegebener Ort, sonst die eigene Kartenposition (Ortsmitte) aus dem Profil
  let position: { lat: number; lng: number } | null = null;
  let naeheHinweis: string | null = null;
  if (umkreis) {
    if (ort) position = await ortPosition(ort);
    if (!position && !ort) {
      const { data: p } = await supabase.from("profiles").select("map_lat, map_lng").eq("id", user.id).maybeSingle();
      if (p?.map_lat != null && p?.map_lng != null) position = { lat: p.map_lat, lng: p.map_lng };
    }
    if (!position) naeheHinweis = ort ? "Diesen Ort konnten wir nicht finden." : "Gib einen Ort oder eine PLZ an, um im Umkreis zu suchen.";
  }
  const zustaende = (Array.isArray(sp.zustand) ? sp.zustand : sp.zustand ? [sp.zustand] : []).filter((z) => z in ZUSTAND_LABEL);

  const filter = {
    q: eins(sp.q),
    art: eins(sp.art),
    kategorie: eins(sp.kategorie),
    unterkategorie: eins(sp.unter),
    groesse: eins(sp.groesse),
    zustand: zustaende,
    preis_min: EURO_ZU_CENT(eins(sp.preis_min)),
    preis_max: EURO_ZU_CENT(eins(sp.preis_max)),
    kostenlos: eins(sp.kostenlos) === "1",
    versand: eins(sp.versand) === "1",
    abholung: eins(sp.abholung) === "1",
    tausch: eins(sp.tausch) === "1",
    ort: position ? "" : ort,
    lat: position?.lat ?? null,
    lng: position?.lng ?? null,
    umkreis_km: position ? Number(umkreis) : null,
    sortierung: eins(sp.sort) || "neu",
    seite,
  };

  const [kategorien, { data }] = await Promise.all([getKategorien(supabase), supabase.rpc("boerse_suche", { p: filter })]);
  const ergebnis = (data ?? { anzahl: 0, angebote: [], pro_seite: 24 }) as { anzahl: number; angebote: Angebot[]; pro_seite: number };
  const haupt = kategorien.filter((k) => !k.eltern);
  const unter = kategorien.filter((k) => k.eltern && k.eltern === filter.kategorie);
  const katName = new Map(kategorien.map((k) => [k.schluessel, k.name]));
  const bilder = await bilderSignieren(supabase, ergebnis.angebote.map((a) => a.bilder[0]).filter(Boolean));
  const filterAktiv = [sp.groesse, sp.zustand, sp.preis_min, sp.preis_max, sp.kostenlos, sp.versand, sp.abholung, sp.tausch, sp.ort, sp.umkreis].some(Boolean);
  const weitere = ergebnis.anzahl > seite * ergebnis.pro_seite;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
      {/* Kopf */}
      <section className="relative isolate overflow-hidden rounded-[var(--radius-l)] bg-brand-ink px-5 py-7 text-white shadow-[var(--shadow)] sm:px-8 sm:py-9">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_20%,rgba(201,146,31,0.35),transparent_45%),radial-gradient(circle_at_10%_110%,rgba(225,29,46,0.45),transparent_50%)]" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.18em] text-brand-gold">
              <Store size={16} /> Community-Marktplatz
            </p>
            <h1 className="mt-1 text-[30px] font-extrabold leading-tight tracking-tight sm:text-[38px]">TanzRaum Börse</h1>
            <p className="mt-1 text-[14.5px] text-white/80 sm:text-[16px]">Kaufen · Verkaufen · Tauschen · Verschenken · Suchen</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/boerse/neu" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-[14px] font-semibold text-white hover:bg-brand-red-deep">
              <Plus size={17} /> Angebot einstellen
            </Link>
            <Link href="/dashboard/boerse/meine" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-[14px] font-semibold text-white hover:bg-white/20">
              Meine Börse
            </Link>
            <Link href="/dashboard/boerse/meine?tab=favoriten" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-[14px] font-semibold text-white hover:bg-white/20" aria-label="Meine Favoriten">
              <Heart size={16} /> <span className="hidden sm:inline">Favoriten</span>
            </Link>
          </div>
        </div>
        <form action="/dashboard/boerse" className="mt-5 flex gap-2">
          {filter.kategorie && <input type="hidden" name="kategorie" value={filter.kategorie} />}
          {filter.art && <input type="hidden" name="art" value={filter.art} />}
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 text-brand-ink">
            <Search size={18} className="shrink-0 text-brand-ink-soft" />
            <input
              name="q"
              defaultValue={filter.q}
              maxLength={80}
              placeholder="Gardekostüm, Gardestiefel 38, Dreispitz …"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              aria-label="Börse durchsuchen"
            />
          </label>
          <button className="min-h-12 shrink-0 rounded-xl bg-brand-gold px-4 text-[14.5px] font-bold text-brand-ink hover:brightness-105 sm:px-5">Suchen</button>
        </form>
      </section>

      {/* Kategorien */}
      <nav aria-label="Kategorien" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Link
          href={link(sp, { kategorie: null, unter: null })}
          className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-[13.5px] font-semibold ${!filter.kategorie ? "border-brand-ink bg-brand-ink text-white" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"}`}
        >
          Alle
        </Link>
        {haupt.map((k) => (
          <Link
            key={k.schluessel}
            href={link(sp, { kategorie: k.schluessel, unter: null })}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-[13.5px] font-semibold ${
              filter.kategorie === k.schluessel ? "border-brand-ink bg-brand-ink text-white" : "border-brand-line bg-white text-brand-ink hover:bg-brand-bg"
            }`}
          >
            <span aria-hidden className="text-[18px]">
              {k.emoji}
            </span>
            {k.name}
          </Link>
        ))}
      </nav>
      {unter.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {unter.map((k) => (
            <Link
              key={k.schluessel}
              href={link(sp, { unter: filter.unterkategorie === k.schluessel ? null : k.schluessel })}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
                filter.unterkategorie === k.schluessel ? "border-brand-red bg-brand-red-wash text-brand-red" : "border-brand-line bg-white text-brand-ink-soft hover:text-brand-ink"
              }`}
            >
              {k.name}
            </Link>
          ))}
        </div>
      )}

      {/* Art + Filter + Sortierung */}
      <div className="flex flex-wrap items-center gap-2">
        {(["", "verkaufen", "tauschen", "verschenken", "suchen"] as (BoerseArt | "")[]).map((a) => (
          <Link
            key={a || "alle"}
            href={link(sp, { art: a || null })}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${filter.art === a ? "bg-brand-red text-white" : "bg-white text-brand-ink ring-1 ring-brand-line hover:bg-brand-bg"}`}
          >
            {a ? (a === "suchen" ? "Suchanzeigen" : ART_LABEL[a]) : "Alle Angebote"}
          </Link>
        ))}
      </div>

      <details className={`${KARTE} group`} open={filterAktiv}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[14.5px] font-bold text-brand-ink">
          <SlidersHorizontal size={17} className="text-brand-red" /> Filter
          {filterAktiv && <span className="rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold text-white">aktiv</span>}
        </summary>
        <form action="/dashboard/boerse" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filter.q && <input type="hidden" name="q" value={filter.q} />}
          {filter.kategorie && <input type="hidden" name="kategorie" value={filter.kategorie} />}
          {filter.unterkategorie && <input type="hidden" name="unter" value={filter.unterkategorie} />}
          {filter.art && <input type="hidden" name="art" value={filter.art} />}
          <label className="field">
            <span>Größe</span>
            <input name="groesse" defaultValue={filter.groesse} maxLength={20} placeholder="z. B. 152 oder 38" />
          </label>
          <label className="field">
            <span>Preis von (€)</span>
            <input name="preis_min" inputMode="decimal" defaultValue={eins(sp.preis_min)} placeholder="0" />
          </label>
          <label className="field">
            <span>Preis bis (€)</span>
            <input name="preis_max" inputMode="decimal" defaultValue={eins(sp.preis_max)} placeholder="beliebig" />
          </label>
          <label className="field">
            <span>Sortierung</span>
            <select name="sort" defaultValue={filter.sortierung}>
              <option value="neu">Neu eingestellt</option>
              <option value="preis_auf">Preis aufsteigend</option>
              <option value="preis_ab">Preis absteigend</option>
              <option value="naehe">Entfernung</option>
            </select>
          </label>
          <label className="field">
            <span>Ort oder PLZ</span>
            <input name="ort" defaultValue={ort} maxLength={60} placeholder="z. B. Mannheim" />
          </label>
          <label className="field">
            <span>Nur in meiner Nähe</span>
            <select name="umkreis" defaultValue={umkreis}>
              <option value="">überall</option>
              <option value="10">bis 10 km</option>
              <option value="25">bis 25 km</option>
              <option value="50">bis 50 km</option>
              <option value="100">bis 100 km</option>
              <option value="250">bis 250 km</option>
            </select>
          </label>
          <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
            <legend className="mb-1 text-[12.5px] font-semibold text-brand-ink-soft">Zustand</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {(Object.keys(ZUSTAND_LABEL) as Zustand[]).map((z) => (
                <label key={z} className="flex items-center gap-1.5 text-[13.5px] text-brand-ink">
                  <input type="checkbox" name="zustand" value={z} defaultChecked={zustaende.includes(z)} className="h-4 w-4 accent-brand-red" /> {ZUSTAND_LABEL[z]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-wrap gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-4">
            {(
              [
                ["kostenlos", "Nur kostenlos"],
                ["versand", "Versand möglich"],
                ["abholung", "Abholung möglich"],
                ["tausch", "Tausch möglich"],
              ] as const
            ).map(([k, t]) => (
              <label key={k} className="flex min-h-9 items-center gap-2 text-[13.5px] font-semibold text-brand-ink">
                <input type="checkbox" name={k} value="1" defaultChecked={eins(sp[k]) === "1"} className="h-4 w-4 accent-brand-red" /> {t}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <button className="min-h-10 rounded-xl bg-brand-red px-5 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep">Filter anwenden</button>
            <Link href="/dashboard/boerse" className="inline-flex min-h-10 items-center rounded-xl border border-brand-line bg-white px-4 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
              Zurücksetzen
            </Link>
          </div>
        </form>
      </details>

      {naeheHinweis && <p className="rounded-xl bg-brand-gold-wash px-4 py-2.5 text-[13px] text-brand-ink">{naeheHinweis}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-brand-ink-soft">
          <strong className="text-brand-ink">{ergebnis.anzahl}</strong> {ergebnis.anzahl === 1 ? "Angebot" : "Angebote"}
          {filter.kategorie ? ` in ${katName.get(filter.kategorie)}` : ""}
          {filter.q ? ` für „${filter.q}“` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5 text-[12.5px]">
          {(
            [
              ["neu", "Neu eingestellt"],
              ["preis_auf", "Preis ↑"],
              ["preis_ab", "Preis ↓"],
            ] as const
          ).map(([s, t]) => (
            <Link
              key={s}
              href={link(sp, { sort: s === "neu" ? null : s })}
              className={`rounded-full px-3 py-1.5 font-semibold ${filter.sortierung === s ? "bg-brand-ink text-white" : "bg-white text-brand-ink-soft ring-1 ring-brand-line hover:text-brand-ink"}`}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>

      {ergebnis.angebote.length === 0 ? (
        <section className={`${KARTE} flex flex-col items-center gap-3 py-12 text-center`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold-wash text-[28px]" aria-hidden>
            🎭
          </div>
          <p className="text-[16px] font-bold text-brand-ink">{filterAktiv || filter.q || filter.kategorie ? "Nichts gefunden" : "Die Börse ist noch leer"}</p>
          <p className="max-w-md text-[14px] text-brand-ink-soft">
            Dein Kostüm sucht einen neuen Auftritt? Stell es ein – oder gib eine Suchanzeige auf, wenn du selbst etwas suchst.
          </p>
          <Link href="/dashboard/boerse/neu" className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-red px-4 text-[14px] font-semibold text-white hover:bg-brand-red-deep">
            <Plus size={17} /> Angebot einstellen
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {ergebnis.angebote.map((a) => (
            <AngebotKarte key={a.id} a={a} bild={bilder.get(a.bilder[0])} kategorie={katName.get(a.unterkategorie ?? a.kategorie)} />
          ))}
        </div>
      )}
      {(weitere || seite > 1) && (
        <div className="flex justify-center gap-2">
          {seite > 1 && (
            <Link href={`${link(sp, {})}${link(sp, {}).includes("?") ? "&" : "?"}seite=${seite - 1}`} className="rounded-xl border border-brand-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
              ← Zurück
            </Link>
          )}
          {weitere && (
            <Link href={`${link(sp, {})}${link(sp, {}).includes("?") ? "&" : "?"}seite=${seite + 1}`} className="rounded-xl border border-brand-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg">
              Weitere Angebote →
            </Link>
          )}
        </div>
      )}
      <p className="text-center text-[12px] text-brand-ink-faint">
        TanzRaum vermittelt nur den Kontakt. Preis, Zahlung, Versand und Übergabe klärt ihr direkt miteinander – bitte keine Vorkasse an Unbekannte.
      </p>
    </div>
  );
}
