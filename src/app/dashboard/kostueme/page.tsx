import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, History, Layers, Package, Plus, Search, Shirt, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { getMeineKinder } from "@/lib/dashboard/getDashboardUebersicht";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { SatzAktionen, SatzFormular, TeilAktionen, TeilFormular, type Person } from "@/components/kostueme/KostuemFormulare";
import { ARTEN, ART_EMOJI, ART_LABEL, KOSTUEM_BUCKET, TEIL_SPALTEN, ZUSTAND_LABEL, datum, istUeberfaellig, type KostuemArt, type Kostuemsatz, type Teil } from "@/lib/kostueme";

export const metadata = { title: "Kostüme & Requisiten – TanzRaum" };

type Filter = { verein?: string; tab?: string; q?: string; art?: string; satz?: string; status?: string };
type TeilMitSatz = Teil & { kostuem_gruppen: { name: string; farbe: string | null } | null };

const STATUS = [
  ["", "Alle"],
  ["lager", "Im Lager"],
  ["ausgegeben", "Ausgegeben"],
  ["ueberfaellig", "Überfällig"],
  ["reparatur", "Reparatur/defekt"],
] as const;

function Marke({ children, ton = "neutral" }: { children: React.ReactNode; ton?: "neutral" | "rot" | "gruen" | "gold" }) {
  const stil = { neutral: "bg-brand-bg text-brand-ink-soft", rot: "bg-brand-red-wash text-brand-red", gruen: "bg-brand-green-wash text-brand-green", gold: "bg-brand-gold-wash text-brand-gold" }[ton];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${stil}`}>{children}</span>;
}

// Foto (kurzlebiger Link) oder Symbol der Art
function Vorschau({ url, art, gross = false }: { url: string | undefined; art: KostuemArt; gross?: boolean }) {
  const masse = gross ? "h-14 w-14" : "h-11 w-11";
  if (url)
    return (
      <a href={url} target="_blank" rel="noopener" className={`${masse} shrink-0 overflow-hidden rounded-xl bg-brand-bg ring-1 ring-brand-line`} title="Foto öffnen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      </a>
    );
  return (
    <span className={`flex ${masse} shrink-0 items-center justify-center rounded-xl bg-brand-bg text-[20px]`} aria-hidden>
      {ART_EMOJI[art]}
    </span>
  );
}

async function fotoLinks(supabase: Awaited<ReturnType<typeof createClient>>, pfade: (string | null | undefined)[]): Promise<Map<string, string>> {
  const liste = [...new Set(pfade.filter((p): p is string => !!p))].slice(0, 500);
  const links = new Map<string, string>();
  if (!liste.length) return links;
  const { data } = await supabase.storage.from(KOSTUEM_BUCKET).createSignedUrls(liste, 3600);
  for (const s of data ?? []) if (s.path && s.signedUrl) links.set(s.path, s.signedUrl);
  return links;
}

function SatzPunkt({ farbe }: { farbe: string | null }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: farbe ?? "#d8dbe2" }} aria-hidden />;
}

export default async function KostuemeSeite({ searchParams }: { searchParams: Promise<Filter> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/kostueme");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  const f = await searchParams;

  // Verwalten: Vereinsadmin bzw. Rollen mit Bereich "Kostueme" (Vereinsverwaltung) – Pruefung in der Datenbank
  const vereine = daten.vereine.filter((v) => !v.vereinGesperrt);
  const rechte = await Promise.all(vereine.map((v) => supabase.rpc("darf_kostueme_verwalten", { p_verein_id: v.vereinId })));
  const verwaltet = vereine.filter((_, i) => rechte[i].data === true);
  const verein = verwaltet.find((v) => v.vereinId === f.verein) ?? verwaltet[0] ?? null;

  // Was habe ich (bzw. meine Kinder) gerade?
  const [{ data: eigene }, kinder] = await Promise.all([supabase.from("vereins_mitglieder").select("id").eq("user_id", user.id), getMeineKinder(supabase)]);
  const meineIds = [...(eigene ?? []).map((e) => e.id as string), ...kinder.map((k) => k.kindVmId)];
  const kindName = new Map(kinder.map((k) => [k.kindVmId, k.name]));
  const { data: beiMirRoh } = meineIds.length
    ? await supabase.from("kostueme").select(`${TEIL_SPALTEN}, kostuem_gruppen(name, farbe)`).in("vereins_mitglied_id", meineIds).order("rueckgabe", { nullsFirst: false })
    : { data: [] };
  const beiMir = (beiMirRoh ?? []) as unknown as TeilMitSatz[];
  const beiMirFotos = await fotoLinks(supabase, beiMir.map((t) => t.bild_pfad));

  const beiMirKarte = beiMir.length > 0 && (
    <section className={KARTE}>
      <KarteKopf icon={UserRound} titel={kinder.length ? "Bei mir und meinen Kindern" : "Bei mir"} untertitel="Vom Verein an dich ausgegeben – bitte bis zum Rückgabedatum zurückgeben." />
      <ul className="flex flex-col divide-y divide-brand-line">
        {beiMir.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
            <Vorschau url={beiMirFotos.get(t.bild_pfad ?? "")} art={t.art} />
            <span className="min-w-0 flex-1">
              <strong className="text-brand-ink">{t.teil}</strong>
              {t.groesse && <span className="text-brand-ink-soft"> · Gr. {t.groesse}</span>}
              {t.anzahl > 1 && <span className="text-brand-ink-soft"> · {t.anzahl}×</span>}
              {t.kostuem_gruppen && <span className="text-brand-ink-soft"> · {t.kostuem_gruppen.name}</span>}
              {kindName.get(t.vereins_mitglied_id ?? "") && <span className="text-brand-ink-soft"> · für {kindName.get(t.vereins_mitglied_id ?? "")}</span>}
            </span>
            {t.rueckgabe ? (
              <Marke ton={istUeberfaellig(t) ? "rot" : "gold"}>
                {istUeberfaellig(t) ? "Überfällig seit" : "Zurück bis"} {datum(t.rueckgabe)}
              </Marke>
            ) : (
              <Marke>seit {datum(t.vergabe_datum)}</Marke>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

  if (!verein) {
    return (
      <div className="mx-auto flex max-w-[900px] flex-col gap-4">
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Shirt size={24} className="text-brand-red" /> Kostüme & Requisiten
        </h1>
        {beiMirKarte || (
          <section className={`${KARTE} flex flex-col items-center gap-2 py-10 text-center`}>
            <p className="text-[16px] font-bold text-brand-ink">Dir ist gerade nichts ausgegeben</p>
            <p className="max-w-md text-[14px] text-brand-ink-soft">
              Sobald dein Verein dir ein Kostüm oder Requisit ausgibt, siehst du es hier – mit Größe und Rückgabedatum. Das Inventar pflegen
              Vereinsadmin und die dafür freigegebenen Rollen (z. B. Betreuer).
            </p>
          </section>
        )}
      </div>
    );
  }

  const vereinId = verein.vereinId;
  const tab = f.tab === "saetze" || f.tab === "verlauf" ? f.tab : "inventar";
  const [{ data: teileRoh }, { data: saetzeRoh }, { data: inhaberRoh }, { data: personenRoh }, { data: verlaufRoh }] = await Promise.all([
    supabase.from("kostueme").select(TEIL_SPALTEN).eq("verein_id", vereinId).order("teil").order("groesse").limit(3000),
    supabase.from("kostuem_gruppen").select("id, name, farbe, beschreibung").eq("verein_id", vereinId).order("name"),
    supabase.rpc("kostueme_inhaber", { p_verein_id: vereinId }),
    supabase.rpc("kostueme_personen", { p_verein_id: vereinId }),
    tab === "verlauf"
      ? supabase
          .from("kostuem_ausgaben")
          .select("id, kostuem_id, vereins_mitglied_id, ausgegeben_am, rueckgabe_bis, zurueck_am, zustand_zurueck, notiz")
          .eq("verein_id", vereinId)
          .order("ausgegeben_am", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);
  const teile = (teileRoh ?? []) as Teil[];
  const saetze = (saetzeRoh ?? []) as Kostuemsatz[];
  const satzVon = new Map(saetze.map((s) => [s.id, s]));
  const name = new Map(((inhaberRoh ?? []) as { vm_id: string; name: string }[]).map((p) => [p.vm_id, p.name]));
  const personen: Person[] = ((personenRoh ?? []) as { vm_id: string; name: string }[]).map((p) => ({ vmId: p.vm_id, name: p.name }));
  const teilVon = new Map(teile.map((t) => [t.id, t]));

  const zahl = {
    gesamt: teile.reduce((s, t) => s + t.anzahl, 0),
    lager: teile.filter((t) => !t.vereins_mitglied_id).reduce((s, t) => s + t.anzahl, 0),
    aus: teile.filter((t) => t.vereins_mitglied_id).reduce((s, t) => s + t.anzahl, 0),
    ueber: teile.filter(istUeberfaellig).length,
    rep: teile.filter((t) => t.zustand === "reparatur" || t.zustand === "defekt").length,
  };

  const q = (f.q ?? "").trim().toLowerCase();
  const gefiltert = teile
    .filter((t) => !f.art || t.art === f.art)
    .filter((t) => !f.satz || (f.satz === "ohne" ? !t.kostuem_gruppe_id : t.kostuem_gruppe_id === f.satz))
    .filter((t) =>
      f.status === "lager"
        ? !t.vereins_mitglied_id
        : f.status === "ausgegeben"
          ? !!t.vereins_mitglied_id
          : f.status === "ueberfaellig"
            ? istUeberfaellig(t)
            : f.status === "reparatur"
              ? t.zustand === "reparatur" || t.zustand === "defekt"
              : true,
    )
    .filter((t) => !q || [t.teil, t.groesse, t.lagerort, t.notiz, satzVon.get(t.kostuem_gruppe_id ?? "")?.name, name.get(t.vereins_mitglied_id ?? "")].some((w) => w?.toLowerCase().includes(q)))
    .sort((a, b) => {
      // nach Kostuemsatz (Teile ohne Satz zuletzt), dann Bezeichnung
      const sa = satzVon.get(a.kostuem_gruppe_id ?? "")?.name, sb = satzVon.get(b.kostuem_gruppe_id ?? "")?.name;
      if (!sa !== !sb) return sa ? -1 : 1;
      return (sa ?? "").localeCompare(sb ?? "", "de") || a.teil.localeCompare(b.teil, "de");
    });

  const fotos = tab === "inventar" ? await fotoLinks(supabase, gefiltert.map((t) => t.bild_pfad)) : new Map<string, string>();

  const link = (neu: Partial<Filter>) => {
    const p = new URLSearchParams();
    const alle = { ...f, ...neu };
    for (const [k, v] of Object.entries(alle)) if (v && !(k === "verein" && verwaltet.length < 2)) p.set(k, v);
    const s = p.toString();
    return `/dashboard/kostueme${s ? `?${s}` : ""}`;
  };
  const tabStil = (aktiv: boolean) =>
    `inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ${aktiv ? "bg-brand-ink text-white" : "bg-white text-brand-ink ring-1 ring-brand-line hover:bg-brand-bg"}`;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
            <Shirt size={24} className="text-brand-red" /> Kostüme & Requisiten
          </h1>
          <p className="text-[13.5px] text-brand-ink-soft">
            {verein.vereinName} · Inventar, Kostümsätze, Ausgabe und Rückgabe. Mitglieder sehen nur, was ihnen (bzw. ihren Kindern) ausgegeben ist.
          </p>
        </div>
        {verwaltet.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Verein">
            {verwaltet.map((v) => (
              <Link key={v.vereinId} href={`/dashboard/kostueme?verein=${v.vereinId}`} className={tabStil(v.vereinId === vereinId)}>
                {v.vereinName}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(
          [
            ["Teile gesamt", zahl.gesamt, Package, "", "neutral"],
            ["Im Lager", zahl.lager, Package, "lager", "gruen"],
            ["Ausgegeben", zahl.aus, UserRound, "ausgegeben", "gold"],
            ["Überfällig", zahl.ueber, AlertTriangle, "ueberfaellig", "rot"],
            ["Reparatur/defekt", zahl.rep, AlertTriangle, "reparatur", "rot"],
          ] as const
        ).map(([label, wert, Icon, status, ton]) => (
          <Link key={label} href={link({ tab: undefined, status: status || undefined })} className={`${KARTE} flex items-center gap-3 !py-3 hover:border-brand-red`}>
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ton === "rot" && wert > 0 ? "bg-brand-red-wash text-brand-red" : ton === "gold" ? "bg-brand-gold-wash text-brand-gold" : ton === "gruen" ? "bg-brand-green-wash text-brand-green" : "bg-brand-bg text-brand-ink-soft"}`}
            >
              <Icon size={18} />
            </span>
            <span>
              <span className="block text-[20px] font-extrabold leading-tight text-brand-ink">{wert}</span>
              <span className="block text-[12px] text-brand-ink-soft">{label}</span>
            </span>
          </Link>
        ))}
      </div>

      {beiMirKarte}

      <nav className="flex flex-wrap gap-2" aria-label="Bereich">
        <Link href={link({ tab: undefined })} className={tabStil(tab === "inventar")}>
          <Package size={15} /> Inventar
        </Link>
        <Link href={link({ tab: "saetze", status: undefined, q: undefined, art: undefined, satz: undefined })} className={tabStil(tab === "saetze")}>
          <Layers size={15} /> Kostümsätze ({saetze.length})
        </Link>
        <Link href={link({ tab: "verlauf", status: undefined, q: undefined, art: undefined, satz: undefined })} className={tabStil(tab === "verlauf")}>
          <History size={15} /> Verlauf
        </Link>
      </nav>

      {tab === "inventar" && (
        <>
          <details className={`${KARTE} group`} open={teile.length === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-brand-ink">
              <Plus size={18} className="text-brand-red" /> Neues Teil hinzufügen
            </summary>
            <div className="mt-3">
              <TeilFormular vereinId={vereinId} saetze={saetze} />
            </div>
          </details>

          <form className={`${KARTE} flex flex-col gap-3 !py-3`} action="/dashboard/kostueme">
            {verwaltet.length > 1 && <input type="hidden" name="verein" value={vereinId} />}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]">
              <label className="field min-w-0">
                <span className="sr-only">Suche</span>
                <input name="q" defaultValue={f.q ?? ""} placeholder="Suchen: Bezeichnung, Größe, Lagerort, Person …" />
              </label>
              <label className="field">
                <span className="sr-only">Art</span>
                <select name="art" defaultValue={f.art ?? ""}>
                  <option value="">Alle Arten</option>
                  {ARTEN.map((a) => (
                    <option key={a} value={a}>
                      {ART_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="sr-only">Kostümsatz</span>
                <select name="satz" defaultValue={f.satz ?? ""}>
                  <option value="">Alle Sätze</option>
                  <option value="ohne">Ohne Satz</option>
                  {saetze.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {f.status && <input type="hidden" name="status" value={f.status} />}
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-ink px-4 text-[13.5px] font-semibold text-white">
                <Search size={16} /> Filtern
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS.map(([wert, label]) => (
                <Link
                  key={wert}
                  href={link({ status: wert || undefined })}
                  className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${(f.status ?? "") === wert ? "bg-brand-red text-white" : "bg-brand-bg text-brand-ink hover:bg-brand-line"}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </form>

          {gefiltert.length === 0 ? (
            <section className={`${KARTE} py-10 text-center text-[14px] text-brand-ink-soft`}>
              {teile.length === 0 ? "Noch keine Teile im Inventar – leg oben das erste an." : "Keine Teile für diese Auswahl."}
            </section>
          ) : (
            <ul className="flex flex-col gap-2">
              {gefiltert.map((t) => {
                const satz = satzVon.get(t.kostuem_gruppe_id ?? "");
                const ueber = istUeberfaellig(t);
                return (
                  <li key={t.id} className={`${KARTE} flex flex-col gap-2 !py-3 lg:flex-row lg:items-start lg:justify-between`}>
                    <div className="flex min-w-0 gap-3">
                      <Vorschau url={fotos.get(t.bild_pfad ?? "")} art={t.art as KostuemArt} gross />
                      <div className="min-w-0">
                        <p className="break-words text-[15px] font-bold text-brand-ink">
                          {t.teil}
                          {t.groesse && <span className="font-semibold text-brand-ink-soft"> · Gr. {t.groesse}</span>}
                          {t.anzahl > 1 && <span className="font-semibold text-brand-ink-soft"> · {t.anzahl}×</span>}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-brand-ink-soft">
                          <Marke>{ART_LABEL[t.art]}</Marke>
                          {satz && (
                            <span className="inline-flex items-center gap-1">
                              <SatzPunkt farbe={satz.farbe} /> {satz.name}
                            </span>
                          )}
                          <Marke ton={t.zustand === "defekt" || t.zustand === "reparatur" ? "rot" : "neutral"}>{ZUSTAND_LABEL[t.zustand]}</Marke>
                          {t.vereins_mitglied_id ? (
                            <Marke ton={ueber ? "rot" : "gold"}>
                              Bei {name.get(t.vereins_mitglied_id) ?? "Mitglied"}
                              {t.rueckgabe ? ` · ${ueber ? "überfällig seit" : "bis"} ${datum(t.rueckgabe)}` : ""}
                            </Marke>
                          ) : (
                            <Marke ton="gruen">Im Lager{t.lagerort ? ` · ${t.lagerort}` : ""}</Marke>
                          )}
                        </p>
                        {t.notiz && <p className="mt-1 break-words text-[12.5px] text-brand-ink-soft">{t.notiz}</p>}
                      </div>
                    </div>
                    <div className="lg:max-w-[560px] lg:shrink-0">
                      <TeilAktionen teil={t} vereinId={vereinId} saetze={saetze} personen={personen} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === "saetze" && (
        <>
          <section className={KARTE}>
            <KarteKopf icon={Plus} titel="Neuer Kostümsatz" untertitel="Ein Satz fasst zusammengehörige Teile zusammen – z. B. die Uniform einer Garde." />
            <SatzFormular vereinId={vereinId} />
          </section>
          {saetze.length === 0 ? (
            <section className={`${KARTE} py-8 text-center text-[14px] text-brand-ink-soft`}>Noch keine Kostümsätze.</section>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {saetze.map((s) => {
                const drin = teile.filter((t) => t.kostuem_gruppe_id === s.id);
                const aus = drin.filter((t) => t.vereins_mitglied_id).length;
                return (
                  <li key={s.id} className={`${KARTE} flex flex-col gap-2`}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={link({ tab: undefined, satz: s.id })} className="min-w-0 hover:text-brand-red">
                        <span className="flex items-center gap-2 text-[15.5px] font-bold text-brand-ink">
                          <SatzPunkt farbe={s.farbe} /> {s.name}
                        </span>
                        {s.beschreibung && <span className="block text-[13px] text-brand-ink-soft">{s.beschreibung}</span>}
                        <span className="mt-1 block text-[12.5px] text-brand-ink-soft">
                          {drin.length} {drin.length === 1 ? "Teil" : "Teile"} · {aus} ausgegeben · {drin.length - aus} im Lager
                        </span>
                      </Link>
                      <SatzAktionen satz={s} vereinId={vereinId} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === "verlauf" && (
        <section className={KARTE}>
          <KarteKopf icon={History} titel="Ausgaben und Rückgaben" untertitel="Die letzten 100 Vorgänge" />
          {(verlaufRoh ?? []).length === 0 ? (
            <p className="text-[13.5px] text-brand-ink-soft">Noch nichts ausgegeben.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-brand-line">
              {(
                (verlaufRoh ?? []) as {
                  id: string;
                  kostuem_id: string;
                  vereins_mitglied_id: string | null;
                  ausgegeben_am: string;
                  rueckgabe_bis: string | null;
                  zurueck_am: string | null;
                  zustand_zurueck: keyof typeof ZUSTAND_LABEL | null;
                  notiz: string | null;
                }[]
              ).map((v) => {
                const t = teilVon.get(v.kostuem_id);
                return (
                  <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
                    <span className="min-w-0 flex-1">
                      <strong className="text-brand-ink">{t?.teil ?? "Teil"}</strong>
                      {t?.groesse && <span className="text-brand-ink-soft"> · Gr. {t.groesse}</span>}
                      <span className="text-brand-ink-soft"> → {name.get(v.vereins_mitglied_id ?? "") ?? "ehemaliges Mitglied"}</span>
                      {v.notiz && <span className="block text-[12.5px] text-brand-ink-soft">{v.notiz}</span>}
                    </span>
                    <span className="text-[12.5px] text-brand-ink-soft">
                      {new Date(v.ausgegeben_am).toLocaleDateString("de-DE")}
                      {v.zurueck_am ? ` – ${new Date(v.zurueck_am).toLocaleDateString("de-DE")}` : ""}
                    </span>
                    {v.zurueck_am ? (
                      <Marke ton="gruen">zurück{v.zustand_zurueck ? ` · ${ZUSTAND_LABEL[v.zustand_zurueck]}` : ""}</Marke>
                    ) : (
                      <Marke ton="gold">ausgegeben{v.rueckgabe_bis ? ` · bis ${datum(v.rueckgabe_bis)}` : ""}</Marke>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
