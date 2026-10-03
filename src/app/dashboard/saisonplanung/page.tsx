import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trophy,
  AlertTriangle,
  Layers,
  Medal,
  CalendarRange,
  Clock,
  MapPin,
  Flag,
  Users,
  UserRound,
  Backpack,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { heuteBerlin } from "@/lib/training/getTraining";
import {
  datumKurz,
  getPlanungsVereine,
  getVereinsStarts,
  saison,
  saisonVon,
  startTitel,
  STATUS_LABEL,
  tageBis,
  zeitraum,
  type Start,
} from "@/lib/turniere/getTurniere";
import { ART_LABEL, getTermine, type Termin, type TerminArt } from "@/lib/kalender/getKalender";
import { KARTE } from "@/components/dashboard/Karten";
import { KarteKopf } from "@/components/dashboard/KarteKopf";

export const metadata = { title: "Saisonplanung – TanzRaum" };

const STATUS_BADGE = { geplant: "offen", gemeldet: "zugesagt", abgesagt: "abgesagt" } as const;
const PUNKT = { geplant: "bg-brand-gold", gemeldet: "bg-brand-green", abgesagt: "bg-brand-red" } as const;

function Kennzahl({ wert, label, hinweis }: { wert: number; label: string; hinweis?: string }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-white p-3">
      <p className="text-[24px] font-extrabold leading-none text-brand-ink">{wert}</p>
      <p className="mt-1 text-[12.5px] font-semibold text-brand-ink-soft">{label}</p>
      {hinweis && <p className="text-[11.5px] text-brand-ink-faint">{hinweis}</p>}
    </div>
  );
}

// Ein Eintrag der Terminliste: Vereinstermin (mit optional verknuepftem Turnier) oder ein geplantes Turnier ohne Termin
type Eintrag = {
  schluessel: string;
  datum: string;
  bisDatum: string | null;
  von: string | null;
  bis: string | null;
  art: TerminArt;
  titel: string;
  href: string;
  ort: string | null;
  termin: Termin | null;
  turnierId: string | null;
  starts: Start[];
};

const ART_FARBE: Partial<Record<TerminArt, string>> = {
  turnier: "bg-brand-gold-wash text-brand-ink",
  auftritt: "bg-brand-red-wash text-brand-red-deep",
  umzug: "bg-brand-purple-wash text-brand-purple",
  fest: "bg-brand-green-wash text-brand-green",
};

const MONAT_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const TAG_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function DatumsKachel({ iso, vorbei }: { iso: string; vorbei?: boolean }) {
  const d = new Date(`${iso}T12:00:00Z`);
  return (
    <div
      className={`flex w-14 shrink-0 flex-col items-center justify-center self-start rounded-xl border py-1.5 ${
        vorbei ? "border-brand-line bg-brand-bg text-brand-ink-soft" : "border-brand-red/25 bg-white text-brand-ink"
      }`}
    >
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-ink-soft">{TAG_KURZ[d.getUTCDay()]}</span>
      <span className="text-[20px] font-extrabold leading-none">{d.getUTCDate()}</span>
      <span className="text-[11px] font-semibold text-brand-ink-soft">{MONAT_KURZ[d.getUTCMonth()]}</span>
    </div>
  );
}

function wannText(e: Eintrag) {
  const tage = e.bisDatum ? zeitraum(e.datum, e.bisDatum) : null;
  const zeit = e.von ? `${e.von}${e.bis ? `–${e.bis}` : ""} Uhr` : "ganztägig";
  return [tage, zeit].filter(Boolean).join(" · ");
}

function werText(t: Termin) {
  if (t.zielgruppe === "gruppen") return t.gruppen.join(", ");
  if (t.zielgruppe === "leitung") return "Vorstand & Trainer";
  return "Ganzer Verein";
}

function TerminZeile({ e, heute, vereinId, vorbei }: { e: Eintrag; heute: string; vereinId: string; vorbei?: boolean }) {
  const t = e.termin;
  const tage = tageBis(e.datum, heute);
  const laeuft = e.datum <= heute && (e.bisDatum ?? e.datum) >= heute;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <DatumsKachel iso={e.datum} vorbei={vorbei} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ART_FARBE[e.art] ?? "bg-brand-bg text-brand-ink-soft"}`}>{ART_LABEL[e.art]}</span>
          {!vorbei && (
            <span className="text-[11.5px] font-semibold text-brand-red">
              {laeuft ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`}
            </span>
          )}
        </div>
        <Link href={e.href} className={`text-[15px] font-bold leading-snug hover:text-brand-red ${vorbei ? "text-brand-ink-soft" : "text-brand-ink"}`}>
          {e.titel}
        </Link>
        <div className="flex flex-col gap-0.5 text-[12.5px] text-brand-ink-soft">
          <span className="inline-flex items-start gap-1.5">
            <Clock size={13} className="mt-0.5 shrink-0" /> {wannText(e)}
          </span>
          {e.ort && (
            <span className="inline-flex items-start gap-1.5">
              <MapPin size={13} className="mt-0.5 shrink-0" /> {e.ort}
            </span>
          )}
          {t && (t.treffpunkt || t.treffzeit) && (
            <span className="inline-flex items-start gap-1.5 text-brand-ink">
              <Flag size={13} className="mt-0.5 shrink-0 text-brand-red" />
              <span>
                Treffpunkt: {[t.treffzeit ? `${t.treffzeit} Uhr` : null, t.treffpunkt].filter(Boolean).join(" · ")}
              </span>
            </span>
          )}
          {t && (
            <span className="inline-flex items-start gap-1.5">
              <Users size={13} className="mt-0.5 shrink-0" /> {werText(t)}
              {t.rueckmeldung && ` · ${t.zusagen} Zusagen · ${t.vielleicht} vielleicht · ${t.absagen} Absagen`}
            </span>
          )}
          {t?.verantwortlich && (
            <span className="inline-flex items-start gap-1.5">
              <UserRound size={13} className="mt-0.5 shrink-0" /> {t.verantwortlich}
            </span>
          )}
          {t?.mitbringen && (
            <span className="inline-flex items-start gap-1.5">
              <Backpack size={13} className="mt-0.5 shrink-0" /> <span className="line-clamp-2">{t.mitbringen}</span>
            </span>
          )}
        </div>
        {e.starts.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {e.starts.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-bg px-2.5 py-1.5">
                <span className={`text-[12.5px] font-semibold text-brand-ink ${x.status === "abgesagt" ? "line-through opacity-60" : ""}`}>{startTitel(x)}</span>
                <span className="text-[12px] text-brand-ink-soft">{[x.disziplin, x.altersklasse, x.tag ? datumKurz(x.tag) : null].filter(Boolean).join(" · ")}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {x.platz !== null && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-ink">
                      <Medal size={12} className="text-brand-gold" /> Platz {x.platz}
                    </span>
                  )}
                  <span className={`status-badge ${STATUS_BADGE[x.status]}`}>{STATUS_LABEL[x.status]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {!t && e.turnierId && !vorbei && (
          <Link
            href={`/dashboard/kalender/neu?${new URLSearchParams({ verein: vereinId, turnier: e.turnierId })}`}
            className="mt-0.5 inline-flex w-fit items-center gap-1 text-[12.5px] font-semibold text-brand-red"
          >
            <Plus size={13} /> Treffpunkt & Infos ergänzen
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function SaisonplanungSeite({ searchParams }: { searchParams: Promise<{ verein?: string; saison?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?weiter=/dashboard/saisonplanung");

  const planung = await getPlanungsVereine(supabase);
  if (planung.length === 0) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Saisonplanung</h1>
        <p className={`${KARTE} text-[14px] text-brand-ink-soft`}>
          Die Saisonplanung steht Vereinsadmins und Trainern (bzw. Mitgliedern mit dem Bereich „Saisonplanung“) in Vereinen mit
          Vereinslizenz zur Verfügung.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const heute = heuteBerlin();
  const verein = planung.find((v) => v.vereinId === sp.verein) ?? planung[0];
  const startjahr = sp.saison && /^\d{4}$/.test(sp.saison) ? Number(sp.saison) : saisonVon(heute);
  const s = saison(startjahr);
  const [starts, alleTermine] = await Promise.all([
    getVereinsStarts(supabase, verein.vereinId, s.von, s.bis),
    getTermine(supabase, s.von, s.bis),
  ]);
  const termine = alleTermine.filter((t) => t.vereinId === verein.vereinId);
  const aktiv = starts.filter((x) => x.status !== "abgesagt");

  const handlungsbedarf = aktiv.filter(
    (x) => x.status === "geplant" && x.letzterTag >= heute && x.meldeschluss !== null && tageBis(x.meldeschluss, heute) <= 14,
  );
  const ergebnisse = aktiv.filter((x) => x.platz !== null || x.punkte !== null);

  // Nach Turnier gruppieren (chronologisch)
  const nachTurnier = new Map<string, Start[]>();
  for (const x of starts) nachTurnier.set(x.turnierId, [...(nachTurnier.get(x.turnierId) ?? []), x]);

  // Nach Gruppe/Solo gruppieren
  const nachTeilnahme = new Map<string, Start[]>();
  for (const x of aktiv) {
    const k = x.gruppeName ?? `Solo: ${startTitel(x)}`;
    nachTeilnahme.set(k, [...(nachTeilnahme.get(k) ?? []), x]);
  }

  // Eine Liste aus Vereinsterminen und geplanten Turnieren; ein Turnier mit uebernommenem Termin erscheint nur einmal
  const eintraege: Eintrag[] = termine.map((t) => ({
    schluessel: `termin-${t.id}`,
    datum: t.datum,
    bisDatum: t.bisDatum,
    von: t.von,
    bis: t.bis,
    art: t.art,
    titel: t.titel,
    href: `/dashboard/kalender/termin/${t.id}`,
    ort: t.ort,
    termin: t,
    turnierId: t.turnierId,
    starts: t.turnierId ? (nachTurnier.get(t.turnierId) ?? []) : [],
  }));
  const mitTermin = new Set(termine.map((t) => t.turnierId).filter(Boolean));
  for (const liste of nachTurnier.values()) {
    const t = liste[0];
    if (mitTermin.has(t.turnierId)) continue;
    eintraege.push({
      schluessel: `turnier-${t.turnierId}`,
      datum: t.ersterTag,
      bisDatum: t.letzterTag > t.ersterTag ? t.letzterTag : null,
      von: null,
      bis: null,
      art: "turnier",
      titel: t.turnierName,
      href: `/dashboard/turniere/${t.turnierId}`,
      ort: t.turnierOrt,
      termin: null,
      turnierId: t.turnierId,
      starts: liste,
    });
  }
  eintraege.sort((a, b) => (a.datum + (a.von ?? "")).localeCompare(b.datum + (b.von ?? "")));
  const kommende = eintraege.filter((e) => (e.bisDatum ?? e.datum) >= heute);
  const vergangene = eintraege.filter((e) => (e.bisDatum ?? e.datum) < heute).reverse();
  const neuerTermin = `/dashboard/kalender/neu?${new URLSearchParams({ von: "saison", verein: verein.vereinId })}`;

  const link = (jahr: number) => `/dashboard/saisonplanung?${new URLSearchParams({ verein: verein.vereinId, saison: String(jahr) })}`;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Saisonplanung</h1>
          <p className="text-[14px] text-brand-ink-soft">
            Alle Termine des Vereins – Turniere, Auftritte, Umzüge, Feste – nach Datum sortiert, die nächsten zuerst.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={neuerTermin}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-3.5 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
          >
            <Plus size={16} /> Termin eintragen
          </Link>
          <Link
            href="/dashboard/turniere"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            <Trophy size={16} /> Turnier übernehmen
          </Link>
          <Link
            href={`/dashboard/turniere/neu?verein=${verein.vereinId}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            <Plus size={16} /> Vereinsturnier
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {planung.length > 1 && (
          <nav className="flex gap-1.5 overflow-x-auto" aria-label="Verein">
            {planung.map((v) => (
              <Link
                key={v.vereinId}
                href={`/dashboard/saisonplanung?${new URLSearchParams({ verein: v.vereinId, saison: String(startjahr) })}`}
                aria-current={v.vereinId === verein.vereinId ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                  v.vereinId === verein.vereinId ? "bg-brand-ink text-white" : "bg-white text-brand-ink-soft hover:text-brand-ink"
                }`}
              >
                {v.vereinName}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-full border border-brand-line bg-white p-1">
          <Link href={link(startjahr - 1)} aria-label="Vorige Saison" className="rounded-full p-1.5 text-brand-ink-soft hover:bg-brand-bg">
            <ChevronLeft size={16} />
          </Link>
          <span className="px-2 text-[13.5px] font-bold text-brand-ink">Saison {s.label}</span>
          <Link href={link(startjahr + 1)} aria-label="Nächste Saison" className="rounded-full p-1.5 text-brand-ink-soft hover:bg-brand-bg">
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kennzahl wert={kommende.length} label="Kommende Termine" hinweis={`${eintraege.length} in der Saison`} />
        <Kennzahl wert={aktiv.length} label="Starts geplant" hinweis={`bei ${new Set(aktiv.map((x) => x.turnierId)).size} Turnieren`} />
        <Kennzahl wert={aktiv.filter((x) => x.status === "gemeldet").length} label="Gemeldet" />
        <Kennzahl wert={aktiv.filter((x) => x.status === "geplant").length} label="Noch nicht gemeldet" />
      </div>

      {handlungsbedarf.length > 0 && (
        <section className={`${KARTE} border-brand-red/30`}>
          <KarteKopf icon={AlertTriangle} titel="Meldeschluss beachten" untertitel="Diese Starts sind noch nicht als gemeldet markiert." />
          <ul className="flex flex-col gap-1.5">
            {handlungsbedarf.map((x) => {
              const tage = tageBis(x.meldeschluss!, heute);
              return (
                <li key={x.id}>
                  <Link href={`/dashboard/turniere/${x.turnierId}`} className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-brand-bg">
                    <span className="status-badge abgesagt">{tage < 0 ? "Frist vorbei" : tage === 0 ? "heute" : `noch ${tage} Tag${tage === 1 ? "" : "e"}`}</span>
                    <span className="text-[13.5px] font-semibold text-brand-ink">{startTitel(x)}</span>
                    <span className="text-[13px] text-brand-ink-soft">· {x.turnierName}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {eintraege.length === 0 ? (
        <section className={`${KARTE} flex flex-col items-center gap-2 py-8 text-center`}>
          <CalendarRange size={28} className="text-brand-ink-faint" />
          <p className="text-[14.5px] font-semibold text-brand-ink">Für die Saison {s.label} ist noch nichts eingetragen.</p>
          <p className="max-w-md text-[13.5px] text-brand-ink-soft">
            Trage Auftritte, Umzüge, Feste und alle anderen Termine ein – oder übernimm ein Turnier aus dem Turnierkalender.
          </p>
          <Link href={neuerTermin} className="mt-1 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-4 text-[13.5px] font-semibold text-white">
            <Plus size={16} /> Ersten Termin eintragen
          </Link>
        </section>
      ) : (
        <div className={`grid grid-cols-1 gap-4 ${starts.length > 0 ? "lg:grid-cols-[1fr_340px]" : ""}`}>
          <div className="flex min-w-0 flex-col gap-4">
            <section className={`${KARTE} flex flex-col gap-3`}>
              <KarteKopf icon={CalendarRange} titel="Kommende Termine" untertitel={kommende.length === 0 ? "In dieser Saison steht nichts mehr an." : undefined} />
              {kommende.length > 0 && (
                <ul className="flex flex-col divide-y divide-brand-line">
                  {kommende.map((e) => (
                    <TerminZeile key={e.schluessel} e={e} heute={heute} vereinId={verein.vereinId} />
                  ))}
                </ul>
              )}
            </section>

            {vergangene.length > 0 && (
              <details className={`${KARTE} group`}>
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] font-bold text-brand-ink">
                  <History size={17} className="text-brand-ink-soft" /> Vergangene Termine ({vergangene.length})
                  <ChevronRight size={16} className="ml-auto text-brand-ink-soft transition-transform group-open:rotate-90" />
                </summary>
                <ul className="mt-3 flex flex-col divide-y divide-brand-line">
                  {vergangene.map((e) => (
                    <TerminZeile key={e.schluessel} e={e} heute={heute} vereinId={verein.vereinId} vorbei />
                  ))}
                </ul>
              </details>
            )}
          </div>

          {starts.length > 0 && (
          <div className="flex flex-col gap-4">
            <section className={KARTE}>
              <KarteKopf icon={Layers} titel="Nach Gruppen" />
              <ul className="flex flex-col gap-3">
                {[...nachTeilnahme.entries()]
                  .sort(([a], [b]) => a.localeCompare(b, "de"))
                  .map(([name, liste]) => (
                    <li key={name}>
                      <p className="text-[13.5px] font-bold text-brand-ink">
                        {name} <span className="font-normal text-brand-ink-soft">· {liste.length} Start{liste.length === 1 ? "" : "s"}</span>
                      </p>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {liste.map((x) => (
                          <li key={x.id} className="flex items-center gap-2 text-[12.5px] text-brand-ink-soft">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${PUNKT[x.status]}`} aria-label={STATUS_LABEL[x.status]} />
                            <span className="w-16 shrink-0">{datumKurz(x.tag ?? x.ersterTag)}</span>
                            <Link href={`/dashboard/turniere/${x.turnierId}`} className="truncate hover:text-brand-ink">
                              {x.turnierName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
              <p className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-brand-ink-faint">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-gold" /> geplant</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-green" /> gemeldet</span>
              </p>
            </section>

            {ergebnisse.length > 0 && (
              <section className={KARTE}>
                <KarteKopf icon={Medal} titel="Ergebnisse" />
                <ul className="flex flex-col gap-1.5">
                  {ergebnisse.map((x) => (
                    <li key={x.id} className="text-[13px] text-brand-ink">
                      <strong>{x.platz !== null ? `Platz ${x.platz}` : "–"}</strong>
                      {x.punkte !== null ? ` · ${x.punkte.toLocaleString("de-DE")} P.` : ""} – {startTitel(x)}
                      <span className="text-brand-ink-soft"> · {x.turnierName}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
