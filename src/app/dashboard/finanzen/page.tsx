import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BookOpen, Download, Layers, PieChart, Plus, Receipt, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import {
  BeitragAktionen,
  BeitragsartAktionen,
  BeitragsartFormular,
  BuchungAktionen,
  BuchungFormular,
  SollstellungFormular,
} from "@/components/finanzen/FinanzFormulare";
import { MeineBeitraege } from "@/components/finanzen/MeineBeitraege";
import { BEITRAG_SPALTEN, BELEG_BUCKET, BUCHUNG_SPALTEN, datumDe, euro, heuteBerlin, type Beitrag, type Beitragsart, type Buchung } from "@/lib/finanzen";

export const metadata = { title: "Finanzen – TanzRaum" };

type Filter = { verein?: string; tab?: string; jahr?: string; status?: string; q?: string };
const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export default async function FinanzenSeite({ searchParams }: { searchParams: Promise<Filter> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/finanzen");
  const daten = await getDashboardData(supabase, user.id);
  if (!daten) redirect("/login");
  const f = await searchParams;

  const vereine = daten.vereine.filter((v) => !v.vereinGesperrt);
  const rechte = await Promise.all(vereine.map((v) => supabase.rpc("darf_finanzen", { p_verein_id: v.vereinId })));
  const verwaltet = vereine.filter((_, i) => rechte[i].data === true);
  const verein = verwaltet.find((v) => v.vereinId === f.verein) ?? verwaltet[0] ?? null;

  if (!verein) {
    return (
      <div className="mx-auto flex max-w-[900px] flex-col gap-4">
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
          <Wallet size={24} className="text-brand-red" /> Finanzen
        </h1>
        <MeineBeitraege />
        <section className={`${KARTE} text-[14px] text-brand-ink-soft`}>
          Kassenbuch und Beiträge verwaltet der Vereinsadmin bzw. die Rollen, denen er den Bereich „Finanzen“ freigibt.
        </section>
      </div>
    );
  }

  const vereinId = verein.vereinId;
  const tab = ["kassenbuch", "beitraege", "arten"].includes(f.tab ?? "") ? f.tab! : "uebersicht";
  const heute = heuteBerlin();
  const jahr = /^\d{4}$/.test(f.jahr ?? "") ? Number(f.jahr) : Number(heute.slice(0, 4));

  const [{ data: buchungenRoh }, { data: alleRoh }, { data: beitraegeRoh }, { data: artenRoh }, { data: personenRoh }, { data: namenRoh }] = await Promise.all([
    supabase
      .from("kassenbuch_eintraege")
      .select(BUCHUNG_SPALTEN)
      .eq("verein_id", vereinId)
      .gte("datum", `${jahr}-01-01`)
      .lte("datum", `${jahr}-12-31`)
      .order("datum", { ascending: false })
      .order("erstellt_am", { ascending: false })
      .limit(5000),
    supabase.from("kassenbuch_eintraege").select("typ, betrag, datum").eq("verein_id", vereinId).lt("datum", `${jahr}-01-01`).limit(50000),
    supabase.from("beitraege").select(BEITRAG_SPALTEN).eq("verein_id", vereinId).order("faellig", { ascending: false }).limit(5000),
    supabase.from("beitragstypen").select("id, name, betrag, rhythmus, aktiv, automatisch, naechste_faelligkeit").eq("verein_id", vereinId).order("name"),
    tab === "beitraege" ? supabase.rpc("finanzen_personen", { p_verein_id: vereinId }) : Promise.resolve({ data: [] }),
    supabase.rpc("finanzen_namen", { p_verein_id: vereinId }),
  ]);
  const buchungen = ((buchungenRoh ?? []) as Buchung[]).map((b) => ({ ...b, betrag: Number(b.betrag) }));
  const beitraege = ((beitraegeRoh ?? []) as Beitrag[]).map((b) => ({ ...b, betrag: Number(b.betrag) }));
  const arten = ((artenRoh ?? []) as Beitragsart[]).map((a) => ({ ...a, betrag: Number(a.betrag) }));
  const personen = ((personenRoh ?? []) as { vm_id: string; name: string; rolle: string }[]).map((p) => ({ vmId: p.vm_id, name: p.name, rolle: p.rolle }));
  const name = new Map(((namenRoh ?? []) as { vm_id: string; name: string }[]).map((p) => [p.vm_id, p.name]));

  const summe = (liste: { typ: string; betrag: number }[], typ: string) => liste.filter((b) => b.typ === typ).reduce((s, b) => s + Number(b.betrag), 0);
  const vortrag = summe((alleRoh ?? []) as { typ: string; betrag: number }[], "einnahme") - summe((alleRoh ?? []) as { typ: string; betrag: number }[], "ausgabe");
  const einnahmen = summe(buchungen, "einnahme");
  const ausgaben = summe(buchungen, "ausgabe");
  const bestand = vortrag + einnahmen - ausgaben;
  const offen = beitraege.filter((b) => !b.bezahlt);
  const ueberfaellig = offen.filter((b) => b.faellig && b.faellig < heute);

  const link = (neu: Partial<Filter>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...neu })) if (v && !(k === "verein" && verwaltet.length < 2)) p.set(k, String(v));
    const s = p.toString();
    return `/dashboard/finanzen${s ? `?${s}` : ""}`;
  };
  const tabStil = (aktiv: boolean) =>
    `inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold ${aktiv ? "bg-brand-ink text-white" : "bg-white text-brand-ink ring-1 ring-brand-line hover:bg-brand-bg"}`;

  // Belege: kurzlebige Links nur fuer die angezeigten Buchungen
  const belegUrls = new Map<string, string>();
  const belege = buchungen.map((b) => b.beleg_pfad).filter((p): p is string => !!p);
  if (tab === "kassenbuch" && belege.length) {
    const { data } = await supabase.storage.from(BELEG_BUCKET).createSignedUrls(belege, 600);
    for (const s of data ?? []) if (s.path && s.signedUrl) belegUrls.set(s.path, s.signedUrl);
  }

  // Monatsverlauf und Kategorien fuer die Uebersicht
  const monate = MONATE.map((_, i) => {
    const m = buchungen.filter((b) => Number(b.datum.slice(5, 7)) === i + 1);
    return { ein: summe(m, "einnahme"), aus: summe(m, "ausgabe") };
  });
  const maxMonat = Math.max(1, ...monate.map((m) => Math.max(m.ein, m.aus)));
  const kategorien = (typ: "einnahme" | "ausgabe") => {
    const map = new Map<string, number>();
    for (const b of buchungen.filter((x) => x.typ === typ)) map.set(b.kategorie || "Ohne Kategorie", (map.get(b.kategorie || "Ohne Kategorie") ?? 0) + b.betrag);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const q = (f.q ?? "").trim().toLowerCase();
  const beitraegeGefiltert = beitraege
    .filter((b) => (f.status === "bezahlt" ? b.bezahlt : f.status === "ueberfaellig" ? !b.bezahlt && !!b.faellig && b.faellig < heute : f.status === "alle" ? true : !b.bezahlt))
    .filter((b) => !q || [b.beitragstyp_name, name.get(b.vereins_mitglied_id)].some((w) => w?.toLowerCase().includes(q)));

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-brand-ink">
            <Wallet size={24} className="text-brand-red" /> Finanzen
          </h1>
          <p className="text-[13.5px] text-brand-ink-soft">{verein.vereinName} · Kassenbuch, Belege und Mitgliedsbeiträge. Keine Zahlungsabwicklung – ihr erfasst, was auf eurem Konto bzw. in der Kasse passiert.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {verwaltet.length > 1 &&
            verwaltet.map((v) => (
              <Link key={v.vereinId} href={`/dashboard/finanzen?verein=${v.vereinId}`} className={tabStil(v.vereinId === vereinId)}>
                {v.vereinName}
              </Link>
            ))}
          <nav className="flex items-center gap-1" aria-label="Jahr">
            {[jahr - 1, jahr, jahr + 1].map((j) => (
              <Link key={j} href={link({ jahr: String(j) })} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${j === jahr ? "bg-brand-red text-white" : "bg-white text-brand-ink ring-1 ring-brand-line"}`}>
                {j}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Bestand Ende " + jahr, euro(bestand), Wallet, bestand < 0 ? "rot" : "neutral"],
            ["Einnahmen " + jahr, euro(einnahmen), TrendingUp, "gruen"],
            ["Ausgaben " + jahr, euro(ausgaben), TrendingDown, "rot"],
            ["Offene Beiträge", `${offen.length} · ${euro(offen.reduce((s, b) => s + b.betrag, 0))}`, AlertTriangle, ueberfaellig.length ? "rot" : "gold"],
          ] as const
        ).map(([label, wert, Icon, ton]) => (
          <div key={label} className={`${KARTE} flex items-center gap-3 !py-3`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ton === "gruen" ? "bg-brand-green-wash text-brand-green" : ton === "rot" ? "bg-brand-red-wash text-brand-red" : ton === "gold" ? "bg-brand-gold-wash text-brand-gold" : "bg-brand-bg text-brand-ink"}`}>
              <Icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block break-words text-[17px] font-extrabold leading-tight text-brand-ink sm:text-[18px]">{wert}</span>
              <span className="block text-[12px] text-brand-ink-soft">{label}</span>
            </span>
          </div>
        ))}
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Bereich">
        <Link href={link({ tab: undefined })} className={tabStil(tab === "uebersicht")}>
          <PieChart size={15} /> Übersicht
        </Link>
        <Link href={link({ tab: "kassenbuch" })} className={tabStil(tab === "kassenbuch")}>
          <BookOpen size={15} /> Kassenbuch
        </Link>
        <Link href={link({ tab: "beitraege" })} className={tabStil(tab === "beitraege")}>
          <Users size={15} /> Beiträge{offen.length ? ` (${offen.length} offen)` : ""}
        </Link>
        <Link href={link({ tab: "arten" })} className={tabStil(tab === "arten")}>
          <Layers size={15} /> Beitragsarten
        </Link>
      </nav>

      {tab === "uebersicht" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className={`${KARTE} lg:col-span-2`}>
            <KarteKopf icon={PieChart} titel={`Einnahmen und Ausgaben ${jahr}`} untertitel={`Übertrag aus den Vorjahren: ${euro(vortrag)}`} />
            <div className="flex h-48 items-end gap-1.5 sm:gap-2" role="img" aria-label="Monatsverlauf">
              {monate.map((m, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div className="flex h-full w-full items-end justify-center gap-0.5">
                    <div className="w-1/2 max-w-3 rounded-t bg-brand-green" style={{ height: `${(m.ein / maxMonat) * 100}%` }} title={`Einnahmen ${MONATE[i]}: ${euro(m.ein)}`} />
                    <div className="w-1/2 max-w-3 rounded-t bg-brand-red" style={{ height: `${(m.aus / maxMonat) * 100}%` }} title={`Ausgaben ${MONATE[i]}: ${euro(m.aus)}`} />
                  </div>
                  <span className="text-[10.5px] text-brand-ink-soft">{MONATE[i]}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 flex gap-4 text-[12px] text-brand-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-green" /> Einnahmen
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-red" /> Ausgaben
              </span>
            </p>
          </section>
          <section className={KARTE}>
            <KarteKopf icon={Receipt} titel="Nach Kategorie" />
            {buchungen.length === 0 ? (
              <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">Für {jahr} gibt es noch keine Buchungen.</p>
            ) : (
              (["einnahme", "ausgabe"] as const).map((typ) => (
                <div key={typ} className="mb-3">
                  <p className={`mb-1 text-[12px] font-bold uppercase tracking-wide ${typ === "einnahme" ? "text-brand-green" : "text-brand-red"}`}>{typ === "einnahme" ? "Einnahmen" : "Ausgaben"}</p>
                  <ul className="flex flex-col gap-1 text-[13px]">
                    {kategorien(typ).map(([k, s]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate text-brand-ink">{k}</span>
                        <span className="shrink-0 font-semibold text-brand-ink">{euro(s)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
          {ueberfaellig.length > 0 && (
            <section className={`${KARTE} lg:col-span-3`}>
              <KarteKopf icon={AlertTriangle} titel={ueberfaellig.length === 1 ? "1 überfälliger Beitrag" : `${ueberfaellig.length} überfällige Beiträge`} alleHref={link({ tab: "beitraege", status: "ueberfaellig" })} />
              <ul className="flex flex-col divide-y divide-brand-line text-[13.5px]">
                {ueberfaellig.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex justify-between gap-2 py-2">
                    <span>
                      <strong>{name.get(b.vereins_mitglied_id) ?? "Mitglied"}</strong> · {b.beitragstyp_name}
                    </span>
                    <span className="text-brand-red">
                      {euro(b.betrag)} · seit {datumDe(b.faellig)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "kassenbuch" && (
        <>
          <details className={KARTE} open={buchungen.length === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-brand-ink">
              <Plus size={18} className="text-brand-red" /> Neue Buchung
            </summary>
            <div className="mt-3">
              <BuchungFormular vereinId={vereinId} />
            </div>
          </details>
          <section className={KARTE}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15.5px] font-bold text-brand-ink">Kassenbuch {jahr}</h2>
              <a
                href={`/dashboard/finanzen/export?verein=${vereinId}&jahr=${jahr}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-line bg-white px-3 text-[12.5px] font-semibold text-brand-ink hover:bg-brand-bg"
              >
                <Download size={14} /> CSV für die Kassenprüfung
              </a>
            </div>
            {buchungen.length === 0 ? (
              <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">Keine Buchungen in {jahr}.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-brand-line">
                {buchungen.map((b) => (
                  <li key={b.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span className="w-[82px] shrink-0 text-[12.5px] text-brand-ink-soft">{datumDe(b.datum)}</span>
                      <div className="min-w-0">
                        <p className="break-words text-[14px] font-semibold text-brand-ink">{b.beschreibung || b.kategorie || (b.typ === "einnahme" ? "Einnahme" : "Ausgabe")}</p>
                        <p className="text-[12px] text-brand-ink-soft">{[b.kategorie, b.zahlungsart, b.beitrag_id ? "aus Beitrag" : null].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[15px] font-extrabold sm:w-32 sm:text-right ${b.typ === "einnahme" ? "text-brand-green" : "text-brand-red"}`}>
                      {b.typ === "einnahme" ? "+" : "−"}
                      {euro(b.betrag)}
                    </span>
                    <div className="sm:w-auto sm:min-w-[150px]">
                      <BuchungAktionen buchung={b} belegUrl={b.beleg_pfad ? (belegUrls.get(b.beleg_pfad) ?? null) : null} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "beitraege" && (
        <>
          <details className={KARTE} open={beitraege.length === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-brand-ink">
              <Plus size={18} className="text-brand-red" /> Beiträge anlegen (Sollstellung)
            </summary>
            <div className="mt-3">
              <SollstellungFormular arten={arten.filter((a) => a.aktiv)} personen={personen} />
            </div>
          </details>
          <section className={KARTE}>
            <form className="mb-3 flex flex-wrap items-center gap-2" action="/dashboard/finanzen">
              <input type="hidden" name="tab" value="beitraege" />
              {verwaltet.length > 1 && <input type="hidden" name="verein" value={vereinId} />}
              {f.status && <input type="hidden" name="status" value={f.status} />}
              <input name="q" defaultValue={f.q ?? ""} placeholder="Name oder Beitragsart …" className="min-h-10 min-w-0 flex-1 rounded-xl border border-brand-line px-3 text-[13.5px]" />
              <button type="submit" className="min-h-10 rounded-xl bg-brand-ink px-4 text-[13px] font-semibold text-white">
                Suchen
              </button>
            </form>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(
                [
                  ["", "Offen"],
                  ["ueberfaellig", "Überfällig"],
                  ["bezahlt", "Bezahlt"],
                  ["alle", "Alle"],
                ] as const
              ).map(([w, l]) => (
                <Link key={w} href={link({ status: w || undefined })} className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${(f.status ?? "") === w ? "bg-brand-red text-white" : "bg-brand-bg text-brand-ink hover:bg-brand-line"}`}>
                  {l}
                </Link>
              ))}
            </div>
            {beitraegeGefiltert.length === 0 ? (
              <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">{beitraege.length === 0 ? "Noch keine Beiträge angelegt." : "Keine Beiträge für diese Auswahl."}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-brand-line">
                {beitraegeGefiltert.map((b) => {
                  const ueber = !b.bezahlt && !!b.faellig && b.faellig < heute;
                  return (
                    <li key={b.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-brand-ink">{name.get(b.vereins_mitglied_id) ?? "Mitglied"}</p>
                        <p className="text-[12.5px] text-brand-ink-soft">
                          {b.beitragstyp_name} · fällig {datumDe(b.faellig)}
                          {b.erinnert_am ? ` · erinnert am ${new Date(b.erinnert_am).toLocaleDateString("de-DE")}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[14.5px] font-bold text-brand-ink sm:w-28 sm:text-right">{euro(b.betrag)}</span>
                      <span
                        className={`shrink-0 self-start rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${b.bezahlt ? "bg-brand-green-wash text-brand-green" : ueber ? "bg-brand-red-wash text-brand-red" : "bg-brand-gold-wash text-brand-gold"}`}
                      >
                        {b.bezahlt ? `bezahlt ${datumDe(b.bezahlt_am)}` : ueber ? "überfällig" : "offen"}
                      </span>
                      <div className="sm:min-w-[220px]">
                        <BeitragAktionen beitrag={b} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "arten" && (
        <>
          <section className={KARTE}>
            <KarteKopf icon={Plus} titel="Neue Beitragsart" untertitel="z. B. Jahresbeitrag Aktive, Kinder, Familie, Kostümumlage" />
            <BeitragsartFormular vereinId={vereinId} />
          </section>
          {arten.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {arten.map((a) => (
                <li key={a.id} className={`${KARTE} flex flex-col gap-2`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-bold text-brand-ink">
                        {a.name} {!a.aktiv && <span className="text-[12px] font-semibold text-brand-ink-soft">(inaktiv)</span>}
                      </p>
                      <p className="text-[13px] text-brand-ink-soft">
                        {euro(a.betrag)} · {a.rhythmus} · {beitraege.filter((b) => b.beitragstyp_id === a.id).length} Beiträge
                      </p>
                      {a.automatisch && a.naechste_faelligkeit && (
                        <p className="mt-1 inline-flex rounded-full bg-brand-green-wash px-2 py-0.5 text-[11.5px] font-semibold text-brand-green">
                          automatisch · nächste Fälligkeit {datumDe(a.naechste_faelligkeit)}
                        </p>
                      )}
                    </div>
                  </div>
                  <BeitragsartAktionen art={a} vereinId={vereinId} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
