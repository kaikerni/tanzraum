import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trophy, AlertTriangle, Layers, Medal, CalendarRange } from "lucide-react";
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
  const starts = await getVereinsStarts(supabase, verein.vereinId, s.von, s.bis);
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

  const link = (jahr: number) => `/dashboard/saisonplanung?${new URLSearchParams({ verein: verein.vereinId, saison: String(jahr) })}`;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-brand-ink">Saisonplanung</h1>
          <p className="text-[14px] text-brand-ink-soft">Welche Gruppe tanzt wann wo – Starts, Meldungen, Zusagen und Ergebnisse der Saison.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/turniere"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-bg"
          >
            <Trophy size={16} /> Turnier aus dem Kalender planen
          </Link>
          <Link
            href={`/dashboard/turniere/neu?verein=${verein.vereinId}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-red px-3.5 text-[13.5px] font-semibold text-white hover:bg-brand-red-deep"
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
        <Kennzahl wert={aktiv.length} label="Starts geplant" hinweis={`bei ${new Set(aktiv.map((x) => x.turnierId)).size} Turnieren`} />
        <Kennzahl wert={aktiv.filter((x) => x.status === "gemeldet").length} label="Gemeldet" />
        <Kennzahl wert={aktiv.filter((x) => x.status === "geplant").length} label="Noch nicht gemeldet" />
        <Kennzahl wert={ergebnisse.length} label="Ergebnisse eingetragen" />
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

      {starts.length === 0 ? (
        <section className={`${KARTE} flex flex-col items-center gap-2 py-8 text-center`}>
          <CalendarRange size={28} className="text-brand-ink-faint" />
          <p className="text-[14.5px] font-semibold text-brand-ink">Für die Saison {s.label} ist noch nichts geplant.</p>
          <p className="max-w-md text-[13.5px] text-brand-ink-soft">
            Öffne ein Turnier im Turnierkalender und tippe auf „Start einplanen“ – oder lege ein eigenes Vereinsturnier an.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <section className={`${KARTE} flex flex-col gap-3`}>
            <KarteKopf icon={Trophy} titel="Turniere der Saison" />
            <ul className="flex flex-col divide-y divide-brand-line">
              {[...nachTurnier.values()].map((liste) => {
                const t = liste[0];
                const vorbei = t.letzterTag < heute;
                return (
                  <li key={t.turnierId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <Link href={`/dashboard/turniere/${t.turnierId}`} className="group flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[14.5px] font-bold text-brand-ink group-hover:text-brand-red">{t.turnierName}</span>
                      <span className="text-[12.5px] text-brand-ink-soft">
                        {zeitraum(t.ersterTag, t.letzterTag)} · {t.turnierOrt}
                        {t.eigenesTurnier ? " · Vereinsturnier" : ""}
                        {vorbei ? " · vorbei" : ""}
                      </span>
                    </Link>
                    <ul className="flex flex-col gap-1.5">
                      {liste.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-bg px-2.5 py-2">
                          <span className={`text-[13.5px] font-semibold text-brand-ink ${x.status === "abgesagt" ? "line-through opacity-60" : ""}`}>{startTitel(x)}</span>
                          <span className="text-[12.5px] text-brand-ink-soft">
                            {[x.disziplin, x.altersklasse, x.tag ? datumKurz(x.tag) : null].filter(Boolean).join(" · ")}
                          </span>
                          <span className="ml-auto flex flex-wrap items-center gap-1.5">
                            {x.teilnehmer > 0 && x.status !== "abgesagt" && !vorbei && (
                              <span className="text-[12px] text-brand-ink-soft">
                                {x.dabei}/{x.teilnehmer} dabei
                              </span>
                            )}
                            {x.platz !== null && (
                              <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-ink">
                                <Medal size={13} className="text-brand-gold" /> Platz {x.platz}
                              </span>
                            )}
                            <span className={`status-badge ${STATUS_BADGE[x.status]}`}>{STATUS_LABEL[x.status]}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>

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
        </div>
      )}
    </div>
  );
}
