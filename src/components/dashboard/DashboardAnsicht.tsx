import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  UserMinus,
  Trophy,
  MessageSquare,
  PieChart,
  ArrowRight,
  Building2,
  Activity,
} from "lucide-react";
import { QuickActions } from "@/components/QuickActions";
import { KpiKarte } from "@/components/dashboard/KpiKarte";
import { KarteKopf } from "@/components/dashboard/KarteKopf";
import { BeteiligungDiagramm } from "@/components/dashboard/BeteiligungDiagramm";
import { ZeitraumAuswahl } from "@/components/dashboard/ZeitraumAuswahl";
import {
  KARTE,
  HeuteKarte,
  RadarKarte,
  NachrichtenKarte,
  TurniereKarte,
  TermineKarte,
  AltersklassenKarte,
  KinderKarte,
  formatDatum,
} from "@/components/dashboard/Karten";

import type { DashboardDaten } from "@/lib/dashboard/getDashboardData";
import { darf, hatTarif, modulAn, type Zugriff } from "@/lib/navigation";
import type { OnlineUebersicht } from "@/lib/online/getOnline";
import { OnlineAnzeige } from "@/components/online/OnlineAnzeige";
import { DatumUhrzeit } from "@/components/dashboard/DatumUhrzeit";
import type {
  DashboardKennzahlen,
  Termin,
  NaechstesTurnier,
  AltersklassenVerteilung,
  HeuteEintrag,
  WochenBeteiligung,
  RadarEintrag,
  MeinKind,
} from "@/lib/dashboard/getDashboardUebersicht";
import type { AktuelleNachricht } from "@/lib/dashboard/getNachrichten";
import type { TrainingsTag } from "@/lib/training/getTraining";
import { TrainingKarte } from "@/components/training/TrainingKarte";

const TARIF_LABEL: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  verein: "Verein",
};

function begruessung(): string {
  // Nur die Stunde (formatToParts), sonst liefert de-DE "11 Uhr" -> NaN -> faelschlich "Guten Abend"
  const stunde = Number(
    new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Berlin" })
      .formatToParts(new Date())
      .find((t) => t.type === "hour")?.value ?? "12",
  );
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

export type DashboardAnsichtProps = {
  daten: DashboardDaten;
  zugriff: Zugriff;
  kennzahlen: DashboardKennzahlen | null;
  termine: Termin[];
  turniere: NaechstesTurnier[];
  altersklassen: AltersklassenVerteilung[];
  heute: HeuteEintrag[];
  verlauf: WochenBeteiligung[];
  radar: RadarEintrag[];
  nachrichten: AktuelleNachricht[];
  kinder: MeinKind[];
  wochen: number;
  online?: OnlineUebersicht | null;
  // Trainings heute (Vereinslizenz): eigene Teilnahme/Kinder und fuer Trainer die Abmeldungen
  trainingHeute?: TrainingsTag[];
  heuteDatum?: string;
};

export function DashboardAnsicht({
  daten,
  zugriff,
  kennzahlen,
  termine,
  turniere,
  altersklassen,
  heute,
  verlauf,
  radar,
  nachrichten,
  kinder,
  wochen,
  online = null,
  trainingHeute = [],
  heuteDatum = "",
}: DashboardAnsichtProps) {
  // TanzRaum-Administration: nur Plattform-Karten (keine Vereins-, Trainings- oder Mitgliederkarten)
  const admin = daten.istPlattformAdmin;
  const hatVerein = !admin && hatTarif(zugriff, "basic") && daten.vereine.length > 0;
  const k = kennzahlen;
  // Vom Verein ausgeschaltete Bereiche erscheinen nirgends im Dashboard
  const mitTraining = modulAn(zugriff, "training");
  const mitTurnieren = modulAn(zugriff, "turniere");
  const mitKalender = modulAn(zugriff, "kalender");
  const termineSichtbar = termine.filter((t) => (mitTurnieren || t.typ !== "turnier") && (mitTraining || t.typ !== "training"));
  const radarSichtbar = radar.filter((r) => mitTurnieren || r.typ !== "turnier");
  const b = k?.beteiligung ?? null;
  const beteiligungDelta = b && b.prozent !== null && b.vormonat !== null ? Math.round(b.prozent - b.vormonat) : null;

  const kpis = [
    k?.mitglieder && (
      <KpiKarte
        key="mitglieder"
        id="mitglieder"
        icon={Users}
        farbe="green"
        wert={k.mitglieder.wert}
        label="Mitglieder"
        zusatz={k.mitglieder.neuWoche > 0 ? `+${k.mitglieder.neuWoche} diese Woche` : "keine neuen diese Woche"}
        zusatzTon={k.mitglieder.neuWoche > 0 ? "positiv" : "neutral"}
        verlauf={k.mitglieder.verlauf}
      />
    ),
    hatVerein && mitTraining && k?.trainingsHeute && (
      <KpiKarte
        key="trainings"
        id="trainings"
        icon={CalendarDays}
        farbe="red"
        wert={k.trainingsHeute.wert}
        label={k.trainingsHeute.wert === 1 ? "Training heute" : "Trainings heute"}
        zusatz={`${k.trainingsHeute.erwartet} Teilnehmer erwartet`}
        verlauf={k.trainingsHeute.verlauf}
      />
    ),
    !admin && mitTraining && k?.abmeldungenHeute && (
      <KpiKarte
        key="abmeldungen"
        id="abmeldungen"
        icon={UserMinus}
        farbe="amber"
        wert={k.abmeldungenHeute.wert}
        label={k.abmeldungenHeute.wert === 1 ? "Abmeldung" : "Abmeldungen"}
        zusatz="heute"
        verlauf={k.abmeldungenHeute.verlauf}
      />
    ),
    mitTurnieren && k?.turniereWoche && (
      <KpiKarte
        key="turniere"
        id="turniere"
        icon={Trophy}
        farbe="gold"
        wert={k.turniereWoche.wert}
        label={k.turniereWoche.wert === 1 ? "Turnier diese Woche" : "Turniere diese Woche"}
        zusatz={
          k.turniereWoche.erstesDatum
            ? `${k.turniereWoche.erstesOrt ?? "Ort offen"} – ${formatDatum(k.turniereWoche.erstesDatum)}`
            : "keine diese Woche"
        }
        verlauf={k.turniereWoche.verlauf}
      />
    ),
    k?.nachrichten && (
      <KpiKarte
        key="nachrichten"
        id="nachrichten"
        icon={MessageSquare}
        farbe="blue"
        wert={k.nachrichten.ungelesen}
        label={k.nachrichten.ungelesen === 1 ? "neue Nachricht" : "neue Nachrichten"}
        zusatz="ungelesen"
        verlauf={k.nachrichten.verlauf}
      />
    ),
    !admin && b && modulAn(zugriff, "anwesenheit") && (
      <KpiKarte
        key="beteiligung"
        id="beteiligung"
        icon={PieChart}
        farbe="navy"
        wert={b.prozent !== null ? `${Math.round(b.prozent)} %` : "–"}
        label="Trainingsbeteiligung"
        zusatz={
          b.prozent === null
            ? "Noch keine Daten"
            : beteiligungDelta === null
              ? "diesen Monat"
              : `${beteiligungDelta >= 0 ? "+" : ""}${beteiligungDelta} % zum Vormonat`
        }
        zusatzTon={beteiligungDelta === null ? "neutral" : beteiligungDelta >= 0 ? "positiv" : "negativ"}
        verlauf={b.verlauf}
      />
    ),
  ].filter(Boolean);

  const zeigeBeteiligung = !admin && darf(zugriff, "verein", "anwesenheit") && modulAn(zugriff, "anwesenheit");
  const zeigeAltersklassen = !admin && darf(zugriff, "verein", "mitglieder");

  return (
    <div className="mx-auto flex max-w-[1560px] flex-col gap-4">
      {/* Hero + Tageskarte */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <section className="relative isolate min-h-[190px] overflow-hidden rounded-[var(--radius-l)] border border-brand-line bg-white shadow-[var(--shadow)] sm:min-h-[220px]">
          <Image
            src="/tanzraum-hero.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 66vw, 100vw"
            className="-z-10 object-cover object-[78%_center] sm:object-right"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/90 to-white/55 sm:to-transparent sm:via-white/60 lg:via-white/30" />
          {/* Text bleibt links vom Bildmotiv (Taenzer ab ca. 60 % der Breite): feste Maximalbreite, Umbruch statt Ueberlauf,
              Schriftgroesse passt sich an Breite und Namenslaenge an */}
          <div className="flex h-full min-w-0 flex-col justify-center px-5 py-6 sm:max-w-[60%] sm:px-8 sm:py-8 lg:max-w-[56%] 2xl:max-w-[52%]">
            <h1
              className={`break-words font-extrabold leading-[1.15] tracking-tight text-brand-ink [hyphens:auto] [text-wrap:balance] ${
                (daten.vorname ?? "").length > 14 ? "text-[22px] sm:text-[26px] xl:text-[30px]" : "text-[26px] sm:text-[30px] xl:text-[34px]"
              }`}
              lang="de"
            >
              {begruessung()}, <span className="whitespace-normal">{daten.vorname ?? "willkommen"}</span>! <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-2 max-w-md text-[14px] text-brand-ink-soft sm:text-[16px]">
              Hier ist dein Überblick über alles Wichtige in TanzRaum.
            </p>
            <p className="mt-4 font-[family-name:var(--font-script)] text-[20px] leading-snug text-brand-red sm:mt-5 sm:text-[24px] xl:text-[26px]">
              „Tanz verbindet – und du machst es möglich!“
            </p>
          </div>
        </section>

        <section className={`${KARTE} flex flex-col justify-between`}>
            <DatumUhrzeit />
            <p className="mt-4 text-[18px] font-semibold leading-snug text-brand-ink">
              „Disziplin heute – Erfolg morgen.“
            </p>
            {online && (
              <div className="mt-4">
                <OnlineAnzeige online={online} admin={daten.istPlattformAdmin} />
              </div>
            )}
          </section>
      </div>

      {/* Training heute: gross und direkt erreichbar (abmelden bzw. Abmeldungen der eigenen Gruppen) */}
      {!admin && mitTraining && zugriff.tarif === "verein" && trainingHeute.length > 0 && (
        <section aria-labelledby="dashboard-training-heute" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="dashboard-training-heute" className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-brand-red">
              Training heute
            </h2>
            <Link href="/dashboard/training" className="text-[13px] font-semibold text-brand-ink-soft hover:text-brand-ink">
              Alle Trainings
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {trainingHeute.map((t) => (
              <li key={`${t.terminId}-${t.datum}`} className="min-w-0">
                <TrainingKarte t={t} heute={heuteDatum} zeigeVerein={new Set(trainingHeute.map((x) => x.vereinId)).size > 1} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Kennzahlen */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">{kpis}</div>
      )}

      {kinder.length > 0 && <KinderKarte kinder={kinder} />}

      {/* Heute / Radar / Schnellaktionen */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hatVerein && mitTraining && <HeuteKarte eintraege={heute} mehrereVereine={daten.vereine.length > 1} />}
        {!admin && <RadarKarte eintraege={radarSichtbar} />}
        <div className={admin ? "md:col-span-2 xl:col-span-3" : "md:col-span-2 xl:col-span-1"}>
          <QuickActions zugriff={zugriff} breit={admin} />
        </div>
      </div>

      {/* Nachrichten / Turniere / Trainingsbeteiligung */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <NachrichtenKarte nachrichten={nachrichten} uebersicht={zugriff.istPlattformAdmin || zugriff.tarif !== "free"} />
        {mitTurnieren && <TurniereKarte turniere={turniere} />}
        {zeigeBeteiligung && (
          <section className={`${KARTE} md:col-span-2 xl:col-span-1`}>
            <KarteKopf
              icon={Activity}
              titel="Trainingsbeteiligung"
              alleHref="/dashboard/statistiken"
              rechts={
                <Suspense>
                  <ZeitraumAuswahl wochen={wochen} />
                </Suspense>
              }
            />
            <BeteiligungDiagramm verlauf={verlauf} />
          </section>
        )}
      </div>

      {/* Bestehende Karten */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {mitKalender && !admin && (
          <div className={zeigeAltersklassen ? "lg:col-span-2" : "lg:col-span-3"}>
            <TermineKarte termine={termineSichtbar} />
          </div>
        )}
        {zeigeAltersklassen && (
          <div className={mitKalender ? "" : "lg:col-span-3"}>
            <AltersklassenKarte altersklassen={altersklassen} />
          </div>
        )}
      </div>

      {!admin && (
      <section className={KARTE}>
        <KarteKopf icon={Building2} titel="Deine Vereine" alleHref="/dashboard/verein" />
        {daten.vereine.length === 0 ? (
          <p className="rounded-xl bg-brand-bg px-3.5 py-3 text-[13px] text-brand-ink-soft">
            Du bist aktuell in keinem Verein Mitglied.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {daten.vereine.map((v) => (
              <li key={v.vereinId} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                <span className="min-w-0 truncate text-brand-ink">
                  <span className="font-semibold">{v.vereinName}</span>
                  {v.rolleName ? <span className="text-brand-ink-soft"> · {v.rolleName}</span> : null}
                </span>
                <span className="shrink-0 text-brand-ink-soft">
                  {v.vereinTarif ? (TARIF_LABEL[v.vereinTarif] ?? v.vereinTarif) : "—"}
                  {v.vereinGesperrt ? " · gesperrt" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {daten.istJuryMitglied && (
        <Link
          href="/juryraum/dashboard"
          className={`${KARTE} flex items-center justify-between transition-all hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-[var(--shadow-hover)]`}
        >
          <div>
            <span className="text-[15px] font-bold text-brand-ink">JuryRaum öffnen</span>
            <span className="mt-0.5 block text-[12.5px] text-brand-ink-soft">
              Einsätze, Verfügbarkeit und Jury-Organisation
            </span>
          </div>
          <ArrowRight size={18} className="text-brand-gold" />
        </Link>
      )}
    </div>
  );
}
